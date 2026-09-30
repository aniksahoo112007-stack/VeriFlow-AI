import { getSupabase } from "../config/supabase.js";

export async function createNotification({
  userId,
  documentId = null,
  type,
  title,
  message,
}) {
  const { error } = await getSupabase()
    .from("notifications")
    .insert({ user_id: userId, document_id: documentId, type, title, message });
  if (error) throw error;
}
