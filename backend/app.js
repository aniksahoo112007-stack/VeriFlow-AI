import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.js";
import { getSupabase } from "./config/supabase.js";
import { asyncHandler } from "./utils/async-handler.js";
import authRoutes from "./routes/auth.routes.js";
import documentRoutes from "./routes/document.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.get("/api/health", (req, res) =>
  res.json({ success: true, service: "VeriFlow API" }),
);
app.get(
  "/api/health/database",
  asyncHandler(async (req, res) => {
    const { error } = await getSupabase()
      .from("users")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) {
      const failure = new Error("Database connectivity check failed.");
      failure.status = 503;
      failure.code = "DATABASE_UNAVAILABLE";
      throw failure;
    }
    res.json({ success: true, database: "connected" });
  }),
);
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
