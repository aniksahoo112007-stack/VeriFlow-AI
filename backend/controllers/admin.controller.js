import { z } from "zod";
import { getSupabase } from "../config/supabase.js";
import { ApiError } from "../utils/api-error.js";
import { writeAudit } from "../services/audit.service.js";

export async function users(req, res) {
  const { data, error } = await getSupabase()
    .from("users")
    .select(
      "id,email,full_name,avatar_url,role,auth_provider,created_at,updated_at",
    )
    .order("created_at", { ascending: false });
  if (error)
    throw new ApiError(500, "Users could not be loaded.", "USERS_FAILED");
  res.json({ success: true, data });
}
export async function updateRole(req, res) {
  const { role } = z
    .object({ role: z.enum(["user", "reviewer", "admin"]) })
    .parse(req.body);
  const { data: before } = await getSupabase()
    .from("users")
    .select("role")
    .eq("id", req.params.id)
    .single();
  if (!before) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  const { data, error } = await getSupabase()
    .from("users")
    .update({ role })
    .eq("id", req.params.id)
    .select("id,email,full_name,role")
    .single();
  if (error)
    throw new ApiError(500, "Role could not be changed.", "ROLE_UPDATE_FAILED");
  await writeAudit({
    userId: req.user.sub,
    action: "ROLE_CHANGED",
    metadata: { targetUserId: req.params.id, previousRole: before.role, role },
  });
  res.json({ success: true, data });
}
export async function audit(req, res) {
  const { data, error } = await getSupabase()
    .from("audit_logs")
    .select(
      "id,action,metadata,created_at,users(full_name,email),documents(original_name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    throw new ApiError(
      500,
      "Audit history could not be loaded.",
      "AUDIT_FAILED",
    );
  res.json({ success: true, data });
}
