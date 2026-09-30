import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseConfig } from "./env.js";

let client;

export function getSupabase() {
  if (!hasSupabaseConfig()) {
    const error = new Error(
      "Supabase is not configured. Set SUPABASE_SECRET_KEY.",
    );
    error.status = 503;
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
