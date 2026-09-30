import { getSupabase } from "../config/supabase.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import {
  logProcessingError,
  logProcessingStage,
  markProcessingStage,
} from "../utils/processing-diagnostics.js";

export const sanitizeFileName = (name) =>
  name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(0, 160) || "document";

export async function uploadFile(path, file) {
  const { error } = await getSupabase()
    .storage.from(env.storageBucket)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error)
    throw new ApiError(
      502,
      "The document could not be stored.",
      "STORAGE_UPLOAD_FAILED",
    );
}

export async function removeFile(path) {
  await getSupabase().storage.from(env.storageBucket).remove([path]);
}

export async function createSignedUrl(path, expiresIn = 300) {
  const { data, error } = await getSupabase()
    .storage.from(env.storageBucket)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl)
    throw new ApiError(
      502,
      "Preview is temporarily unavailable.",
      "SIGNED_URL_FAILED",
    );
  return data.signedUrl;
}

export async function downloadFile(path, context = {}) {
  const safeContext = { documentId: context.documentId };
  logProcessingStage("storage_download", "started", safeContext);
  let data;
  try {
    const result = await getSupabase()
      .storage.from(env.storageBucket)
      .download(path);
    if (result.error || !result.data) {
      const failure = new ApiError(
        502,
        "The stored document could not be read.",
        "STORAGE_DOWNLOAD_FAILED",
        result.error || { reason: "Storage returned no file data" },
      );
      failure.cause = result.error || undefined;
      throw failure;
    }
    data = result.data;
    logProcessingStage("storage_download", "completed", {
      ...safeContext,
      blobBytes: data.size,
      blobType: data.type,
    });
  } catch (error) {
    const staged = markProcessingStage(error, "storage_download");
    logProcessingError("storage_download", staged, safeContext);
    throw staged;
  }

  logProcessingStage("file_buffer_creation", "started", safeContext);
  try {
    const buffer = Buffer.from(await data.arrayBuffer());
    logProcessingStage("file_buffer_creation", "completed", {
      ...safeContext,
      bufferBytes: buffer.length,
    });
    return buffer;
  } catch (error) {
    const staged = markProcessingStage(error, "file_buffer_creation");
    logProcessingError("file_buffer_creation", staged, safeContext);
    throw staged;
  }
}
