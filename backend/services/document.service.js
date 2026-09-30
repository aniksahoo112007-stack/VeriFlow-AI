import crypto from "node:crypto";
import { getSupabase } from "../config/supabase.js";
import { ApiError } from "../utils/api-error.js";
import {
  uploadFile,
  removeFile,
  sanitizeFileName,
  createSignedUrl,
  downloadFile,
} from "./storage.service.js";
import { extractDocument } from "./gemini.service.js";
import { validateDocument, assessRisk } from "./validation.service.js";
import { writeAudit } from "./audit.service.js";
import { createNotification } from "./notification.service.js";
import { env } from "../config/env.js";
import {
  logProcessingError,
  logProcessingStage,
  markProcessingStage,
  safeErrorDetails,
} from "../utils/processing-diagnostics.js";

const fieldMap = {
  documentType: "document_type",
  vendorName: "vendor_name",
  documentNumber: "document_number",
  documentDate: "document_date",
  currency: "currency",
  subtotal: "subtotal",
  taxAmount: "tax_amount",
  totalAmount: "total_amount",
  purchaseOrderNumber: "purchase_order_number",
  gstin: "gstin",
  dueDate: "due_date",
  lineItems: "line_items",
  summary: "summary",
  confidence: "ai_confidence",
};

export const serializeDocument = (row) =>
  Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      value,
    ]),
  );

export function canAccess(user, document) {
  return (
    document.user_id === user.sub || ["reviewer", "admin"].includes(user.role)
  );
}

export async function requireDocument(id, user, diagnostics = false) {
  const { data, error } = await getSupabase()
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    const failure = new ApiError(
      404,
      "Document not found.",
      "DOCUMENT_NOT_FOUND",
      error ? safeErrorDetails(error) : { reason: "No document row returned" },
    );
    failure.cause = error || undefined;
    if (diagnostics) {
      failure.stage = "document_lookup";
      logProcessingError("document_lookup", failure, { documentId: id });
    }
    throw failure;
  }
  if (!canAccess(user, data))
    throw new ApiError(403, "You cannot access this document.", "FORBIDDEN");
  return data;
}

export async function createDocument(userId, file) {
  if (!file)
    throw new ApiError(400, "Select a document to upload.", "FILE_REQUIRED");
  const id = crypto.randomUUID();
  const storagePath = `${userId}/${id}/${sanitizeFileName(file.originalname)}`;
  await uploadFile(storagePath, file);
  const { data, error } = await getSupabase()
    .from("documents")
    .insert({
      id,
      user_id: userId,
      original_name: file.originalname,
      storage_path: storagePath,
      mime_type: file.mimetype,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (error) {
    await removeFile(storagePath);
    throw new ApiError(
      500,
      "Document metadata could not be saved.",
      "DOCUMENT_CREATE_FAILED",
    );
  }
  await writeAudit({
    userId,
    documentId: id,
    action: "DOCUMENT_UPLOADED",
    metadata: { originalName: file.originalname, sizeBytes: file.size },
  });
  return serializeDocument(data);
}

export async function listDocuments(user, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
  let builder = getSupabase()
    .from("documents")
    .select(
      "id,user_id,original_name,mime_type,size_bytes,document_type,document_number,vendor_name,document_date,currency,total_amount,status,processing_status,ai_confidence,risk_score,risk_level,processing_error,created_at,updated_at,users(full_name,email)",
      { count: "exact" },
    );
  if (user.role === "user") builder = builder.eq("user_id", user.sub);
  if (query.status) builder = builder.eq("status", query.status);
  if (query.processingStatus)
    builder = builder.eq("processing_status", query.processingStatus);
  if (query.documentType)
    builder = builder.eq("document_type", query.documentType);
  if (query.risk) builder = builder.eq("risk_level", query.risk);
  if (query.search) {
    const safe = String(query.search)
      .replace(/[,%()]/g, " ")
      .trim();
    if (safe)
      builder = builder.or(
        `original_name.ilike.%${safe}%,vendor_name.ilike.%${safe}%,document_number.ilike.%${safe}%,purchase_order_number.ilike.%${safe}%`,
      );
  }
  const { data, error, count } = await builder
    .order("created_at", { ascending: query.sort === "oldest" })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error)
    throw new ApiError(
      500,
      "Documents could not be loaded.",
      "DOCUMENT_LIST_FAILED",
    );
  return {
    items: data.map(serializeDocument),
    pagination: {
      page,
      pageSize,
      total: count || 0,
      pages: Math.ceil((count || 0) / pageSize),
    },
  };
}

export async function getDocumentDetail(id, user) {
  const document = await requireDocument(id, user);
  const supabase = getSupabase();
  const [{ data: validations }, { data: approvals }, { data: audit }] =
    await Promise.all([
      supabase
        .from("validation_results")
        .select("*")
        .eq("document_id", id)
        .order("created_at"),
      supabase
        .from("approvals")
        .select("*, users(full_name,email)")
        .eq("document_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_logs")
        .select("id,action,metadata,created_at,users(full_name,email)")
        .eq("document_id", id)
        .order("created_at", { ascending: false }),
    ]);
  let previewUrl = null;
  try {
    previewUrl = await createSignedUrl(document.storage_path);
  } catch {
    /* dedicated preview endpoint remains available */
  }
  return {
    document: serializeDocument(document),
    validations: (validations || []).map(serializeDocument),
    approvals: (approvals || []).map(serializeDocument),
    audit: (audit || []).map(serializeDocument),
    previewUrl,
  };
}

async function persistValidation(document) {
  const supabase = getSupabase();
  const context = { documentId: document.id };
  let stage = "deterministic_validation";
  try {
    logProcessingStage(stage, "started", context);
    const results = await validateDocument(document, supabase);
    logProcessingStage(stage, "completed", {
      ...context,
      resultCount: results.length,
      failedCheckCount: results.filter((result) => !result.passed).length,
    });

    stage = "risk_calculation";
    logProcessingStage(stage, "started", {
      ...context,
      resultCount: results.length,
    });
    const risk = assessRisk(results);
    logProcessingStage(stage, "completed", {
      ...context,
      riskScore: risk.score,
      riskLevel: risk.level,
    });

    stage = "validation_results_delete";
    logProcessingStage(stage, "started", context);
    const { error: deleteError } = await supabase
      .from("validation_results")
      .delete()
      .eq("document_id", document.id);
    if (deleteError) {
      const failure = new ApiError(
        500,
        "Previous validation results could not be replaced.",
        "VALIDATION_DELETE_FAILED",
        safeErrorDetails(deleteError),
      );
      failure.cause = deleteError;
      throw failure;
    }
    logProcessingStage(stage, "completed", context);

    stage = "validation_results_insert";
    logProcessingStage(stage, "started", {
      ...context,
      resultCount: results.length,
    });
    if (results.length) {
      const { error: insertError } = await supabase
        .from("validation_results")
        .insert(
          results.map((validation) => ({
            ...validation,
            document_id: document.id,
            metadata: validation.metadata ?? {},
            field_name: validation.field_name ?? null,
            expected_value: validation.expected_value ?? null,
            actual_value: validation.actual_value ?? null,
          })),
        );
      if (insertError) {
        const failure = new ApiError(
          500,
          "Validation results could not be saved.",
          "VALIDATION_SAVE_FAILED",
          safeErrorDetails(insertError),
        );
        failure.cause = insertError;
        throw failure;
      }
    }
    logProcessingStage(stage, "completed", {
      ...context,
      insertedCount: results.length,
    });

    const linked = results.find(
      (result) => result.metadata?.referenceDocumentId,
    )?.metadata?.referenceDocumentId;
    if (linked) {
      stage = "document_link_update";
      logProcessingStage(stage, "started", context);
      const { error: linkError } = await supabase.from("document_links").upsert(
        {
          source_document_id: document.id,
          reference_document_id: linked,
          relation_type: "invoice_matches_purchase_order",
        },
        {
          onConflict: "source_document_id,reference_document_id,relation_type",
          ignoreDuplicates: true,
        },
      );
      if (linkError) {
        const failure = new ApiError(
          500,
          "The purchase-order relationship could not be saved.",
          "DOCUMENT_LINK_FAILED",
          safeErrorDetails(linkError),
        );
        failure.cause = linkError;
        throw failure;
      }
      logProcessingStage(stage, "completed", context);
    }

    stage = "risk_document_update";
    logProcessingStage(stage, "started", {
      ...context,
      riskScore: risk.score,
      riskLevel: risk.level,
    });
    const { data, error } = await supabase
      .from("documents")
      .update({ risk_score: risk.score, risk_level: risk.level })
      .eq("id", document.id)
      .select()
      .single();
    if (error) {
      const failure = new ApiError(
        500,
        "Risk assessment could not be saved.",
        "RISK_SAVE_FAILED",
        safeErrorDetails(error),
      );
      failure.cause = error;
      throw failure;
    }
    logProcessingStage(stage, "completed", context);
    return { document: data, results, risk };
  } catch (error) {
    const staged = markProcessingStage(error, stage);
    logProcessingError(staged.stage, staged, context);
    throw staged;
  }
}

export async function processDocument(id, user) {
  let supabase;
  let document;
  let stage = "document_lookup";
  try {
    logProcessingStage(stage, "started", { documentId: id });
    supabase = getSupabase();
    document = await requireDocument(id, user, true);
    logProcessingStage(stage, "completed", {
      documentId: id,
      mimeType: document.mime_type,
      sizeBytes: document.size_bytes,
      processingStatus: document.processing_status,
    });

    stage = "document_state_check";
    if (document.processing_status === "processing") {
      const failure = new ApiError(
        409,
        "This document is already being processed.",
        "ALREADY_PROCESSING",
      );
      failure.stage = stage;
      throw failure;
    }

    stage = "processing_status_update";
    logProcessingStage(stage, "started", { documentId: id });
    const { error: statusError } = await supabase
      .from("documents")
      .update({ processing_status: "processing", processing_error: null })
      .eq("id", id);
    if (statusError) {
      const failure = new ApiError(
        500,
        "Document processing status could not be updated.",
        "PROCESSING_STATUS_UPDATE_FAILED",
        safeErrorDetails(statusError),
      );
      failure.cause = statusError;
      throw failure;
    }
    logProcessingStage(stage, "completed", { documentId: id });

    stage = "processing_started_audit";
    await writeAudit({
      userId: user.sub,
      documentId: id,
      action: "AI_PROCESSING_STARTED",
    });

    stage = "storage_download";
    const buffer = await downloadFile(document.storage_path, {
      documentId: id,
    });

    stage = "gemini_request";
    const { extraction, modelUsed } = await extractDocument(
      buffer,
      document.mime_type,
      { documentId: id },
    );
    const update = {
      ai_model: modelUsed,
      raw_extraction: extraction,
      processed_at: new Date().toISOString(),
      processing_status: "completed",
      status: "under_review",
    };
    for (const [from, to] of Object.entries(fieldMap))
      if (Object.hasOwn(extraction, from)) update[to] = extraction[from];

    stage = "document_update";
    logProcessingStage(stage, "started", {
      documentId: id,
      extractedFieldCount: Object.keys(update).length,
    });
    const { data: updated, error } = await supabase
      .from("documents")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      const failure = new ApiError(
        500,
        "Extracted data could not be saved.",
        "EXTRACTION_SAVE_FAILED",
        safeErrorDetails(error),
      );
      failure.cause = error;
      throw failure;
    }
    logProcessingStage(stage, "completed", { documentId: id });

    stage = "deterministic_validation";
    const validation = await persistValidation(updated);

    stage = "processing_completed_audit";
    await writeAudit({
      userId: user.sub,
      documentId: id,
      action: "AI_PROCESSING_COMPLETED",
      metadata: {
        model: modelUsed,
        confidence: extraction.confidence,
        riskScore: validation.risk.score,
      },
    });

    stage = "processing_completed_notification";
    await createNotification({
      userId: document.user_id,
      documentId: id,
      type: "processing_completed",
      title: "Analysis complete",
      message: `${document.original_name} is ready for review.`,
    });
    logProcessingStage("process_complete", "completed", {
      documentId: id,
      riskScore: validation.risk.score,
      riskLevel: validation.risk.level,
    });
    return {
      document: serializeDocument(validation.document),
      validations: validation.results.map(serializeDocument),
    };
  } catch (error) {
    const staged = markProcessingStage(error, error.stage || stage);
    logProcessingError(staged.stage, staged, { documentId: id });
    const safeMessage = ["AI_NOT_CONFIGURED", "AI_SERVICE_BUSY"].includes(
      staged.code,
    )
      ? staged.message
      : "Document analysis could not be completed. You can retry.";
    const shouldRecordFailure =
      document &&
      !["ALREADY_PROCESSING", "DOCUMENT_NOT_FOUND", "FORBIDDEN"].includes(
        staged.code,
      );
    if (shouldRecordFailure) {
      try {
        const { error: failureStatusError } = await supabase
          .from("documents")
          .update({
            processing_status: "failed",
            processing_error: safeMessage,
          })
          .eq("id", id);
        if (failureStatusError) throw failureStatusError;
      } catch (cleanupError) {
        logProcessingError("failure_status_update", cleanupError, {
          documentId: id,
          originalFailureStage: staged.stage,
        });
      }
      try {
        await writeAudit({
          userId: user.sub,
          documentId: id,
          action: "AI_PROCESSING_FAILED",
          metadata: {
            code: staged.code || "PROCESSING_FAILED",
            stage: staged.stage,
          },
        });
      } catch (cleanupError) {
        logProcessingError("failure_audit", cleanupError, {
          documentId: id,
          originalFailureStage: staged.stage,
        });
      }
      try {
        await createNotification({
          userId: document.user_id,
          documentId: id,
          type: "processing_failed",
          title: "Analysis needs attention",
          message: `${document.original_name} could not be processed. Retry when the integration is ready.`,
        });
      } catch (cleanupError) {
        logProcessingError("failure_notification", cleanupError, {
          documentId: id,
          originalFailureStage: staged.stage,
        });
      }
    }
    throw staged;
  }
}

export async function editExtraction(id, user, changes) {
  const document = await requireDocument(id, user);
  const update = {};
  for (const [from, to] of Object.entries(fieldMap))
    if (Object.hasOwn(changes, from)) update[to] = changes[from];
  const previous = Object.fromEntries(
    Object.entries(update).map(([key]) => [key, document[key]]),
  );
  const { data, error } = await getSupabase()
    .from("documents")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error)
    throw new ApiError(500, "Changes could not be saved.", "EDIT_FAILED");
  const validation = await persistValidation(data);
  await getSupabase().from("approvals").insert({
    document_id: id,
    actor_user_id: user.sub,
    action: "edited_extraction",
    comment: "Extracted fields corrected",
  });
  await writeAudit({
    userId: user.sub,
    documentId: id,
    action: "DOCUMENT_EDITED",
    metadata: { previous, changes: update },
  });
  return {
    document: serializeDocument(validation.document),
    validations: validation.results.map(serializeDocument),
  };
}

export async function reviewDocument(id, user, { action, comment }) {
  const document = await requireDocument(id, user);
  const isOwner = document.user_id === user.sub;
  if (!isOwner && !["reviewer", "admin"].includes(user.role))
    throw new ApiError(403, "You cannot review this document.", "FORBIDDEN");
  const { error } = await getSupabase()
    .from("approvals")
    .insert({ document_id: id, actor_user_id: user.sub, action, comment });
  if (error)
    throw new ApiError(
      500,
      "Review decision could not be saved.",
      "REVIEW_FAILED",
    );
  await getSupabase().from("documents").update({ status: action }).eq("id", id);
  const auditAction =
    action === "approved"
      ? "DOCUMENT_APPROVED"
      : action === "rejected"
        ? "DOCUMENT_REJECTED"
        : "REVIEW_REQUESTED";
  await writeAudit({
    userId: user.sub,
    documentId: id,
    action: auditAction,
    metadata: { comment },
  });
  await createNotification({
    userId: document.user_id,
    documentId: id,
    type: action,
    title:
      action === "review_requested" ? "Review requested" : `Document ${action}`,
    message: `${document.original_name} was ${action.replace("_", " ")}.`,
  });
  return { status: action };
}

export async function previewDocument(id, user) {
  const document = await requireDocument(id, user);
  return createSignedUrl(document.storage_path);
}
