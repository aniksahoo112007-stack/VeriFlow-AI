import { getOverview } from "../services/analytics.service.js";
export async function overview(req, res) {
  res.json({ success: true, data: await getOverview(req.user) });
}
