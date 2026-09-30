import { getSupabase } from "../config/supabase.js";

export async function writeAudit({
  userId,
  documentId = null,
  action,
  metadata = {},
}) {
  const { error } = await getSupabase()
    .from("audit_logs")
    .insert({ user_id: userId, document_id: documentId, action, metadata });
  if (error) throw error;
}
