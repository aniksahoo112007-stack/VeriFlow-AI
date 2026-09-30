import { GoogleGenAI } from "@google/genai";
import { env, hasGeminiConfig } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import {
  anomalyAnalysisSchema,
  extractionSchema,
} from "../validators/document.validators.js";
import {
  logProcessingError,
  logProcessingStage,
  markProcessingStage,
  safeErrorDetails,
} from "../utils/processing-diagnostics.js";

const responseSchema = {
  type: "object",
  required: [
    "documentType",
    "lineItems",
    "confidence",
    "missingFields",
    "warnings",
  ],
  properties: {
    documentType: {
      type: "string",
      enum: [
        "invoice",
        "purchase_order",
        "receipt",
        "payment",
        "expense_bill",
        "form",
        "contract",
        "other",
      ],
    },
    vendorName: { type: ["string", "null"] },
    vendorAddress: { type: ["string", "null"] },
    vendorPhone: { type: ["string", "null"] },
    vendorEmail: { type: ["string", "null"] },
    documentNumber: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    receiptNumber: { type: ["string", "null"] },
    purchaseOrderNumber: { type: ["string", "null"] },
    utrNumber: { type: ["string", "null"] },
    transactionId: { type: ["string", "null"] },
    referenceNumber: { type: ["string", "null"] },
    documentDate: { type: ["string", "null"] },
    transactionDate: { type: ["string", "null"] },
    dueDate: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    subtotal: { type: ["number", "null"] },
    taxAmount: { type: ["number", "null"] },
    gstAmount: { type: ["number", "null"] },
    cgst: { type: ["number", "null"] },
    sgst: { type: ["number", "null"] },
    igst: { type: ["number", "null"] },
    discount: { type: ["number", "null"] },
    totalAmount: { type: ["number", "null"] },
    paidAmount: { type: ["number", "null"] },
    balanceAmount: { type: ["number", "null"] },
    gstin: { type: ["string", "null"] },
    pan: { type: ["string", "null"] },
    bankName: { type: ["string", "null"] },
    accountLast4: { type: ["string", "null"] },
    paymentMethod: { type: ["string", "null"] },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        required: ["description"],
        properties: {
          description: { type: "string" },
          quantity: { type: ["number", "null"] },
          unitPrice: { type: ["number", "null"] },
          amount: { type: ["number", "null"] },
        },
      },
    },
    summary: { type: ["string", "null"] },
    visibleLogos: { type: ["array", "null"], items: { type: "string" } },
    visibleStamps: { type: ["array", "null"], items: { type: "string" } },
    visibleSignatures: { type: ["array", "null"], items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    missingFields: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

const anomalyResponseSchema = {
  type: "object",
  required: ["anomalies"],
  properties: {
    anomalies: {
      type: "array",
      items: {
        type: "object",
        required: ["type", "severity", "reason", "evidence"],
        properties: {
          type: { type: "string" },
          severity: { type: "string", enum: ["info", "warning", "critical"] },
          reason: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
  },
};

const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const CAPACITY_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);
const TRANSIENT_ERROR_CODES = new Set([
  "ABORT_ERR",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ESOCKETTIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
  "UNAVAILABLE",
  "RESOURCE_EXHAUSTED",
]);
const CAPACITY_ERROR_CODES = new Set([
  "UNAVAILABLE",
  "RESOURCE_EXHAUSTED",
  "INTERNAL",
]);
const PERMANENT_MESSAGE_PATTERN =
  /(?:api key.*(?:invalid|expired|missing)|invalid api key|permission denied|unauthenticated|invalid request|bad request|unsupported|malformed|model.*not found)/i;
const TRANSIENT_MESSAGE_PATTERN =
  /(?:fetch failed|network error|socket hang up|timed?\s*out|timeout|temporar(?:y|ily)|try again|connection reset|high demand|overload|service unavailable)/i;
const CAPACITY_MESSAGE_PATTERN =
  /(?:high demand|capacity|overload|resource exhausted|temporar(?:y|ily).*(?:busy|unavailable)|service unavailable|model.*unavailable|try again later)/i;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function errorChain(error) {
  const chain = [];
  let current = error;
  while (current && chain.length < 5) {
    chain.push(current);
    current = current.cause;
  }
  return chain;
}

function numericStatus(error) {
  for (const item of errorChain(error)) {
    for (const value of [item?.status, item?.statusCode, item?.code]) {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 599)
        return parsed;
    }
  }
  const message = errorChain(error)
    .map((item) => item?.message || "")
    .join(" ");
  const match = message.match(/(?:HTTP\s*)?\b(408|429|500|502|503|504)\b/i);
  return match ? Number(match[1]) : null;
}

function normalizedCodes(error) {
  return errorChain(error)
    .flatMap((item) => [item?.code, item?.status])
    .filter((value) => typeof value === "string")
    .map((value) => value.toUpperCase());
}

function combinedMessage(error) {
  return errorChain(error)
    .map((item) => item?.message || "")
    .join(" ");
}

export function isTransientGeminiError(error) {
  const status = numericStatus(error);
  if (status != null) {
    if (TRANSIENT_HTTP_STATUSES.has(status)) return true;
    if (status >= 400 && status < 500) return false;
  }
  const message = combinedMessage(error);
  if (PERMANENT_MESSAGE_PATTERN.test(message)) return false;
  if (normalizedCodes(error).some((code) => TRANSIENT_ERROR_CODES.has(code)))
    return true;
  return TRANSIENT_MESSAGE_PATTERN.test(message);
}

export function isCapacityGeminiError(error) {
  const status = numericStatus(error);
  if (status != null && CAPACITY_HTTP_STATUSES.has(status)) return true;
  if (normalizedCodes(error).some((code) => CAPACITY_ERROR_CODES.has(code)))
    return true;
  return CAPACITY_MESSAGE_PATTERN.test(combinedMessage(error));
}

export function retryDelayMs(failedAttempt, randomValue = Math.random()) {
  const baseDelay = 1000 * 2 ** (failedAttempt - 1);
  const jitterMultiplier = 0.8 + randomValue * 0.4;
  return Math.round(baseDelay * jitterMultiplier);
}

class ModelRequestFailure extends Error {
  constructor(model, attempts, cause) {
    super(cause?.message || `Gemini request failed for ${model}`);
    this.name = "ModelRequestFailure";
    this.model = model;
    this.attempts = attempts;
    this.cause = cause;
    this.code = cause?.code;
    this.status = numericStatus(cause) || cause?.status;
    this.transient = attempts.every((attempt) => attempt.transient);
    this.allCapacity = attempts.every((attempt) => attempt.capacity);
  }
}

export async function requestModelWithRetry({
  ai,
  model,
  contents,
  context,
  maxAttempts,
  responseJsonSchema = responseSchema,
  sleepFn = sleep,
  randomFn = Math.random,
}) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    logProcessingStage("gemini_request", "attempt_started", {
      ...context,
      selectedModel: model,
      attempt,
      maxAttempts,
    });
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema,
        },
      });
      logProcessingStage("gemini_request", "attempt_succeeded", {
        ...context,
        selectedModel: model,
        attempt,
        maxAttempts,
      });
      return response;
    } catch (error) {
      const transient = isTransientGeminiError(error);
      const capacity = isCapacityGeminiError(error);
      attempts.push({ attempt, transient, capacity });
      logProcessingError("gemini_request", error, {
        ...context,
        selectedModel: model,
        attempt,
        maxAttempts,
        transient,
        capacity,
        status: numericStatus(error),
        codes: normalizedCodes(error),
      });
      if (!transient || attempt === maxAttempts)
        throw new ModelRequestFailure(model, attempts, error);

      const delayMs = retryDelayMs(attempt, randomFn());
      logProcessingStage("gemini_backoff", "waiting", {
        ...context,
        selectedModel: model,
        failedAttempt: attempt,
        nextAttempt: attempt + 1,
        delayMs,
      });
      await sleepFn(delayMs);
    }
  }
  throw new Error("Gemini retry loop ended unexpectedly");
}

export async function extractDocument(buffer, mimeType, context = {}) {
  const safeContext = {
    documentId: context.documentId,
    mimeType,
    bufferBytes: buffer.length,
  };
  if (!hasGeminiConfig()) {
    const error = new ApiError(
      503,
      "Gemini is not configured. Add GEMINI_API_KEY and verify GEMINI_MODEL.",
      "AI_NOT_CONFIGURED",
    );
    error.stage = "gemini_request";
    logProcessingError("gemini_request", error, safeContext);
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `Classify this business document and extract only facts visibly supported by it. DO NOT INVENT VALUES. If a value is not clearly visible, return null. Dates must be YYYY-MM-DD. Search carefully for payment identifiers labelled UTR, UTR No, UTR Number, Transaction ID, Transaction Ref, Reference No, Payment Reference, Bank Reference, Txn ID, or RRN. Normalize a UTR into utrNumber, an explicit transaction/Txn ID into transactionId, and other payment/bank/reference values into referenceNumber. Keep distinct identifiers separate. confidence means extraction confidence only: how certain you are that visible fields were read correctly. It is never an authenticity, fraud, or genuineness score. Record only visibly present logos, stamps, and signatures. Use other when document classification evidence is weak.`,
        },
        { inlineData: { mimeType, data: buffer.toString("base64") } },
      ],
    },
  ];
  let response;
  let modelUsed = env.geminiModel;
  try {
    response = await requestModelWithRetry({
      ai,
      model: env.geminiModel,
      contents,
      context: safeContext,
      maxAttempts: 3,
    });
  } catch (error) {
    if (error.transient && error.allCapacity && env.geminiFallbackModel) {
      modelUsed = env.geminiFallbackModel;
      logProcessingStage("gemini_fallback", "activated", {
        ...safeContext,
        primaryModel: env.geminiModel,
        fallbackModel: modelUsed,
        primaryAttempts: error.attempts.length,
      });
      try {
        response = await requestModelWithRetry({
          ai,
          model: modelUsed,
          contents,
          context: safeContext,
          maxAttempts: 2,
        });
      } catch (fallbackError) {
        logProcessingError("gemini_fallback", fallbackError, {
          ...safeContext,
          selectedModel: modelUsed,
          primaryModel: env.geminiModel,
        });
        const busy = new ApiError(
          503,
          "AI service is temporarily busy. Your document is safe. Please retry shortly.",
          "AI_SERVICE_BUSY",
          safeErrorDetails(fallbackError),
        );
        busy.stage = "gemini_request";
        busy.cause = fallbackError;
        throw busy;
      }
    } else if (error.transient) {
      const busy = new ApiError(
        503,
        "AI service is temporarily busy. Your document is safe. Please retry shortly.",
        "AI_SERVICE_BUSY",
        safeErrorDetails(error),
      );
      busy.stage = "gemini_request";
      busy.cause = error;
      throw busy;
    } else {
      const wrapped = new ApiError(
        502,
        `AI processing failed for model ${env.geminiModel}. Check the model and API configuration.`,
        "AI_PROCESSING_FAILED",
        safeErrorDetails(error),
      );
      wrapped.stage = "gemini_request";
      wrapped.cause = error;
      throw wrapped;
    }
  }

  logProcessingStage("gemini_response", "received", {
    ...safeContext,
    selectedModel: modelUsed,
    responseId: response.responseId,
    modelVersion: response.modelVersion,
    hasText: Boolean(response.text),
    textCharacters: response.text?.length || 0,
    finishReason: response.candidates?.[0]?.finishReason,
  });

  let parsed;
  const responseContext = { ...safeContext, selectedModel: modelUsed };
  logProcessingStage("structured_response_parsing", "started", responseContext);
  try {
    const text = response.text?.trim();
    if (!text) throw new Error("Gemini returned an empty text response");
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
    logProcessingStage("structured_response_parsing", "completed", {
      ...responseContext,
      topLevelKeys:
        parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
    });
  } catch (error) {
    const staged = markProcessingStage(error, "structured_response_parsing");
    logProcessingError("structured_response_parsing", staged, responseContext);
    const wrapped = new ApiError(
      502,
      `AI processing failed for model ${modelUsed}. Check the model and API configuration.`,
      "AI_PROCESSING_FAILED",
      safeErrorDetails(staged),
    );
    wrapped.stage = "structured_response_parsing";
    wrapped.cause = staged;
    throw wrapped;
  }

  logProcessingStage("zod_validation", "started", responseContext);
  let extraction;
  try {
    extraction = extractionSchema.parse(parsed);
    logProcessingStage("zod_validation", "completed", {
      ...responseContext,
      documentType: extraction.documentType,
      confidence: extraction.confidence,
      lineItemCount: extraction.lineItems.length,
      missingFieldCount: extraction.missingFields.length,
      warningCount: extraction.warnings.length,
    });
  } catch (error) {
    const staged = markProcessingStage(error, "zod_validation");
    logProcessingError("zod_validation", staged, responseContext);
    const wrapped = new ApiError(
      502,
      `AI processing failed for model ${modelUsed}. Check the model and API configuration.`,
      "AI_RESPONSE_VALIDATION_FAILED",
      safeErrorDetails(staged),
    );
    wrapped.stage = "zod_validation";
    wrapped.cause = staged;
    throw wrapped;
  }

  const anomalyContents = [
    {
      role: "user",
      parts: [
        {
          text: `Review this same document for evidence-based visual or semantic anomalies only. Consider inconsistent fonts or alignment, visibly edited totals, pasted-looking logos, inconsistent dates, conflicting values, missing expected sections, and mismatched transaction/payment fields. Return only the requested anomalies JSON. Every anomaly must identify concrete visible evidence. Do not claim fraud, forgery, authenticity, or intent as fact. Do not infer an anomaly merely because extraction confidence is low. Extracted context: ${JSON.stringify({
            documentType: extraction.documentType,
            vendorName: extraction.vendorName,
            documentNumber: extraction.documentNumber,
            invoiceNumber: extraction.invoiceNumber,
            purchaseOrderNumber: extraction.purchaseOrderNumber,
            utrNumber: extraction.utrNumber,
            transactionId: extraction.transactionId,
            referenceNumber: extraction.referenceNumber,
            documentDate: extraction.documentDate,
            transactionDate: extraction.transactionDate,
            currency: extraction.currency,
            subtotal: extraction.subtotal,
            taxAmount: extraction.taxAmount,
            totalAmount: extraction.totalAmount,
            paidAmount: extraction.paidAmount,
          })}`,
        },
        { inlineData: { mimeType, data: buffer.toString("base64") } },
      ],
    },
  ];
  let anomalyResponse;
  let anomalyModelUsed = modelUsed;
  try {
    anomalyResponse = await requestModelWithRetry({
      ai,
      model: modelUsed,
      contents: anomalyContents,
      context: { ...safeContext, analysis: "anomaly" },
      maxAttempts: modelUsed === env.geminiModel ? 3 : 2,
      responseJsonSchema: anomalyResponseSchema,
    });
  } catch (error) {
    if (
      modelUsed === env.geminiModel &&
      error.transient &&
      error.allCapacity &&
      env.geminiFallbackModel
    ) {
      anomalyModelUsed = env.geminiFallbackModel;
      anomalyResponse = await requestModelWithRetry({
        ai,
        model: anomalyModelUsed,
        contents: anomalyContents,
        context: { ...safeContext, analysis: "anomaly" },
        maxAttempts: 2,
        responseJsonSchema: anomalyResponseSchema,
      });
    } else {
      throw error;
    }
  }

  try {
    logProcessingStage("anomaly_response_parsing", "started", {
      ...safeContext,
      selectedModel: anomalyModelUsed,
    });
    const text = anomalyResponse.text?.trim();
    if (!text) throw new Error("Gemini returned an empty anomaly response");
    const anomalies = anomalyAnalysisSchema.parse(
      JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()),
    ).anomalies;
    logProcessingStage("anomaly_response_parsing", "completed", {
      ...safeContext,
      selectedModel: anomalyModelUsed,
      anomalyCount: anomalies.length,
    });
    return { extraction, anomalies, modelUsed, anomalyModelUsed };
  } catch (error) {
    const staged = markProcessingStage(error, "anomaly_response_parsing");
    logProcessingError(staged.stage, staged, safeContext);
    const wrapped = new ApiError(
      502,
      `AI anomaly analysis failed for model ${anomalyModelUsed}.`,
      "AI_RESPONSE_VALIDATION_FAILED",
      safeErrorDetails(staged),
    );
    wrapped.stage = staged.stage;
    wrapped.cause = staged;
    throw wrapped;
  }
}
