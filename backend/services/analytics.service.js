import { getSupabase } from "../config/supabase.js";
import { ApiError } from "../utils/api-error.js";

export async function getOverview(user) {
  const supabase = getSupabase();
  let query = supabase
    .from("documents")
    .select(
      "id,status,processing_status,document_type,risk_level,ai_confidence,created_at,processed_at",
    );
  if (user.role === "user") query = query.eq("user_id", user.sub);
  const { data: docs, error } = await query.order("created_at");
  if (error)
    throw new ApiError(
      500,
      "Analytics could not be loaded.",
      "ANALYTICS_FAILED",
    );
  const count = (field, value) => docs.filter((d) => d[field] === value).length;
  const group = (field) =>
    Object.entries(
      docs.reduce((acc, d) => {
        const key = d[field] || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    ).map(([name, value]) => ({ name, value }));
  const byDay = Object.entries(
    docs.reduce((acc, d) => {
      const key = d.created_at.slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  ).map(([date, documents]) => ({ date, documents }));
  const completed = docs.filter((d) => d.processing_status === "completed");
  const confidenceDocs = completed.filter((d) => d.ai_confidence != null);
  const durations = completed
    .filter((d) => d.processed_at)
    .map((d) => (new Date(d.processed_at) - new Date(d.created_at)) / 1000)
    .filter((v) => v >= 0);
  let activityQuery = supabase
    .from("audit_logs")
    .select("id,action,created_at,document_id,documents(original_name)")
    .order("created_at", { ascending: false })
    .limit(8);
  if (user.role === "user") activityQuery = activityQuery.eq("user_id", user.sub);
  const { data: recentActivity, error: activityError } = await activityQuery;
  if (activityError)
    throw new ApiError(
      500,
      "Recent activity could not be loaded.",
      "ACTIVITY_FAILED",
    );
  return {
    totalDocuments: docs.length,
    processedDocuments: completed.length,
    pendingProcessing: count("processing_status", "pending"),
    underReview: count("status", "under_review"),
    approved: count("status", "approved"),
    rejected: count("status", "rejected"),
    reviewRequested: count("status", "review_requested"),
    lowRisk: count("risk_level", "low"),
    mediumRisk: count("risk_level", "medium"),
    highRisk: count("risk_level", "high"),
    averageConfidence: confidenceDocs.length
      ? confidenceDocs.reduce((sum, d) => sum + Number(d.ai_confidence), 0) /
        confidenceDocs.length
      : 0,
    approvalRate: completed.length
      ? count("status", "approved") / completed.length
      : 0,
    averageProcessingSeconds: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
    documentsByType: group("document_type"),
    riskDistribution: group("risk_level"),
    documentsOverTime: byDay,
    recentActivity: recentActivity || [],
  };
}
