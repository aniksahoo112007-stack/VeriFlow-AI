import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { overview } from "../controllers/analytics.controller.js";
const router = Router();
router.get("/overview", requireAuth, asyncHandler(overview));
export default router;
