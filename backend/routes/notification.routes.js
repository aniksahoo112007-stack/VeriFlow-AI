import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import * as controller from "../controllers/notification.controller.js";
const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(controller.list));
router.patch("/:id/read", asyncHandler(controller.read));
export default router;
