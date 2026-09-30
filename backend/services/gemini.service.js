import { GoogleGenAI } from "@google/genai";
import { env, hasGeminiConfig } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import { extractionSchema } from "../validators/document.validators.js";
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
        "expense_bill",
        "form",
        "contract",
        "other",
      ],
    },
    vendorName: { type: ["string", "null"] },
    documentNumber: { type: ["string", "null"] },
    documentDate: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    subtotal: { type: ["number", "null"] },
    taxAmount: { type: ["number", "null"] },
    totalAmount: { type: ["number", "null"] },
    purchaseOrderNumber: { type: ["string", "null"] },
    gstin: { type: ["string", "null"] },
    dueDate: { type: ["string", "null"] },
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
    confidence: { type: "number", minimum: 0, maximum: 1 },
    missingFields: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
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
          responseJsonSchema: responseSchema,
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
          text: "Classify this business document and extract only facts visibly supported by it. DO NOT INVENT VALUES. If a field cannot be confidently found, return null. Use other when classification evidence is weak. Dates must be YYYY-MM-DD. Confidence is overall extraction confidence from 0 to 1.",
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
  try {
    const extraction = extractionSchema.parse(parsed);
    logProcessingStage("zod_validation", "completed", {
      ...responseContext,
      documentType: extraction.documentType,
      confidence: extraction.confidence,
      lineItemCount: extraction.lineItems.length,
      missingFieldCount: extraction.missingFields.length,
      warningCount: extraction.warnings.length,
    });
    return { extraction, modelUsed };
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
}
