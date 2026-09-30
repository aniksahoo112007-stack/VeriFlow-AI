import * as documents from "../services/document.service.js";
import {
  editExtractionSchema,
  reviewSchema,
} from "../validators/document.validators.js";
import {
  logProcessingError,
  logProcessingStage,
} from "../utils/processing-diagnostics.js";

export async function list(req, res) {
  res.json({
    success: true,
    data: await documents.listDocuments(req.user, req.query),
  });
}
export async function create(req, res) {
  res.status(201).json({
    success: true,
    data: await documents.createDocument(req.user.sub, req.file),
  });
}
export async function detail(req, res) {
  res.json({
    success: true,
    data: await documents.getDocumentDetail(req.params.id, req.user),
  });
}
export async function process(req, res) {
  logProcessingStage("controller", "request_received", {
    documentId: req.params.id,
  });
  try {
    const data = await documents.processDocument(req.params.id, req.user);
    logProcessingStage("controller", "request_completed", {
      documentId: req.params.id,
    });
    res.json({ success: true, data });
  } catch (error) {
    logProcessingError(error.stage || "controller", error, {
      documentId: req.params.id,
    });
    throw error;
  }
}
export async function preview(req, res) {
  res.json({
    success: true,
    data: {
      url: await documents.previewDocument(req.params.id, req.user),
      expiresIn: 300,
    },
  });
}
export async function edit(req, res) {
  res.json({
    success: true,
    data: await documents.editExtraction(
      req.params.id,
      req.user,
      editExtractionSchema.parse(req.body),
    ),
  });
}
export async function review(req, res) {
  res.json({
    success: true,
    data: await documents.reviewDocument(
      req.params.id,
      req.user,
      reviewSchema.parse(req.body),
    ),
  });
}
