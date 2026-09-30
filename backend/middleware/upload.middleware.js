import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

const allowed = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowed.has(file.mimetype))
      return callback(
        new ApiError(
          415,
          "Only PDF, PNG, JPEG, and WebP files are supported.",
          "UNSUPPORTED_FILE",
        ),
      );
    callback(null, true);
  },
});
