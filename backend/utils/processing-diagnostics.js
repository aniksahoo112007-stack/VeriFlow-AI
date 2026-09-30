import { env } from "../config/env.js";

const sensitiveKeyPattern =
  /(?:api[-_]?key|secret|authorization|cookie|token|credential|password|base64|binary|buffer|inline[-_]?data|file[-_]?data)/i;

const knownSecrets = [
  env.geminiApiKey,
  env.supabaseSecretKey,
  env.accessSecret,
  env.refreshSecret,
].filter((value) => typeof value === "string" && value.length >= 8);

function redactString(value) {
  let redacted = String(value);
  for (const secret of knownSecrets)
    redacted = redacted.split(secret).join("[REDACTED]");
  redacted = redacted
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(
      /([?&](?:key|api_key|token|access_token)=)[^&\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/[A-Za-z0-9+/]{200,}={0,2}/g, "[REDACTED_LONG_ENCODED_DATA]");
  return redacted.length > 1500 ? `${redacted.slice(0, 1500)}…` : redacted;
}

function sanitize(value, depth = 0, seen = new WeakSet()) {
  if (value == null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function")
    return `[Function ${value.name || "anonymous"}]`;
  if (depth >= 3) return "[Truncated]";
  if (typeof value !== "object") return redactString(value);
  if (Buffer.isBuffer(value) || value instanceof ArrayBuffer)
    return `[Binary omitted: ${value.byteLength ?? value.length} bytes]`;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value))
    return value.slice(0, 20).map((item) => sanitize(item, depth + 1, seen));

  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 30)) {
    output[key] =
      /bytes$/i.test(key) && typeof item === "number"
        ? item
        : sensitiveKeyPattern.test(key)
          ? "[REDACTED]"
          : sanitize(item, depth + 1, seen);
  }
  return output;
}

export function safeErrorDetails(error, depth = 0) {
  if (!error)
    return {
      name: "UnknownError",
      message: "No error object was provided",
    };
  const summary = {
    name: error.name || "Error",
    message: redactString(error.message || String(error)),
  };
  if (error.code != null) summary.code = sanitize(error.code);
  if (error.status != null) summary.status = sanitize(error.status);
  if (error.statusCode != null) summary.statusCode = sanitize(error.statusCode);
  if (error.details != null) summary.details = sanitize(error.details);
  if (error.issues != null) summary.issues = sanitize(error.issues);
  if (error.errors != null) summary.errors = sanitize(error.errors);
  if (error.errorDetails != null)
    summary.errorDetails = sanitize(error.errorDetails);
  if (error.cause != null && depth < 2)
    summary.cause = safeErrorDetails(error.cause, depth + 1);
  if (error.response != null) {
    summary.response = sanitize({
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
    });
  }
  return summary;
}

export function logProcessingStage(stage, event, context = {}) {
  console.info(
    "[document-processing]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      stage,
      event,
      ...sanitize(context),
    }),
  );
}

export function logProcessingError(stage, error, context = {}) {
  console.error(
    "[document-processing]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      stage,
      event: "failed",
      ...sanitize(context),
      error: safeErrorDetails(error),
    }),
  );
}

export function markProcessingStage(error, stage) {
  const target = error instanceof Error ? error : new Error(String(error));
  if (!target.stage) target.stage = stage;
  return target;
}
