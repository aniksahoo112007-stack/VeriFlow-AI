import "dotenv/config";

const isPlaceholder = (value = "") =>
  !value || /PASTE_|your-project|changeme/i.test(value);

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "documents",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  geminiFallbackModel:
    process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite",
  accessSecret: process.env.JWT_ACCESS_SECRET || "",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "",
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 10),
};

export const hasSupabaseConfig = () =>
  !isPlaceholder(env.supabaseUrl) && !isPlaceholder(env.supabaseSecretKey);
export const hasGeminiConfig = () =>
  !isPlaceholder(env.geminiApiKey) && Boolean(env.geminiModel);
export const hasJwtConfig = () =>
  !isPlaceholder(env.accessSecret) && !isPlaceholder(env.refreshSecret);

export function validateProductionConfig() {
  if (env.nodeEnv !== "production") return;
  const missing = [];
  if (!hasSupabaseConfig()) missing.push("SUPABASE_URL/SUPABASE_SECRET_KEY");
  if (!hasGeminiConfig()) missing.push("GEMINI_API_KEY/GEMINI_MODEL");
  if (!hasJwtConfig()) missing.push("JWT_ACCESS_SECRET/JWT_REFRESH_SECRET");
  if (missing.length)
    throw new Error(
      `Missing required production configuration: ${missing.join(", ")}`,
    );
}
