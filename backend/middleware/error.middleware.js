import multer from "multer";
import { ZodError } from "zod";

export function notFound(req, res) {
  res
    .status(404)
    .json({ success: false, message: "Route not found", code: "NOT_FOUND" });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let code = error.code || "INTERNAL_ERROR";
  let message = error.message || "An unexpected error occurred";
  let details;

  if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Please check the submitted values.";
    details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (error instanceof multer.MulterError) {
    status = 400;
    code = error.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_ERROR";
    message =
      error.code === "LIMIT_FILE_SIZE"
        ? "The selected file is too large."
        : error.message;
  }

  if (status >= 500 && process.env.NODE_ENV === "production")
    message = ["SUPABASE_NOT_CONFIGURED", "AI_SERVICE_BUSY"].includes(code)
      ? message
      : "The service could not complete this request.";
  const isDevelopmentProcessError =
    process.env.NODE_ENV !== "production" &&
    req.method === "POST" &&
    /^\/api\/documents\/[^/]+\/process(?:\?.*)?$/.test(req.originalUrl);
  res.status(status).json({
    success: false,
    message,
    code,
    ...(isDevelopmentProcessError && error.stage ? { stage: error.stage } : {}),
    ...(details ? { details } : {}),
  });
}
