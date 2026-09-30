import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadDocument } from "../middleware/upload.middleware.js";
import * as controller from "../controllers/document.controller.js";
const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(controller.list));
router.post(
  "/",
  uploadDocument.single("file"),
  asyncHandler(controller.create),
);
router.get("/:id", asyncHandler(controller.detail));
router.post("/:id/process", asyncHandler(controller.process));
router.get("/:id/preview", asyncHandler(controller.preview));
router.patch("/:id/extracted-fields", asyncHandler(controller.edit));
router.post("/:id/review", asyncHandler(controller.review));
export default router;
