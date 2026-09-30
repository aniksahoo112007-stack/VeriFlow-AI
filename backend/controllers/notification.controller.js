import { getSupabase } from "../config/supabase.js";
import { ApiError } from "../utils/api-error.js";

export async function list(req, res) {
  const { data, error } = await getSupabase()
    .from("notifications")
    .select("*")
    .eq("user_id", req.user.sub)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    throw new ApiError(
      500,
      "Notifications could not be loaded.",
      "NOTIFICATIONS_FAILED",
    );
  res.json({ success: true, data });
}
export async function read(req, res) {
  const { data, error } = await getSupabase()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("user_id", req.user.sub)
    .select()
    .maybeSingle();
  if (error || !data)
    throw new ApiError(
      404,
      "Notification not found.",
      "NOTIFICATION_NOT_FOUND",
    );
  res.json({ success: true, data });
}
