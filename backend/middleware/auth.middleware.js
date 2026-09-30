import jwt from "jsonwebtoken";
import { env, hasJwtConfig } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

export function requireAuth(req, res, next) {
  if (!hasJwtConfig())
    return next(
      new ApiError(
        503,
        "Authentication is not configured.",
        "AUTH_NOT_CONFIGURED",
      ),
    );
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token)
    return next(new ApiError(401, "Authentication required.", "UNAUTHORIZED"));
  try {
    req.user = jwt.verify(token, env.accessSecret, { algorithms: ["HS256"] });
    next();
  } catch {
    next(new ApiError(401, "Your session has expired.", "TOKEN_EXPIRED"));
  }
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(
          new ApiError(
            403,
            "You do not have permission to perform this action.",
            "FORBIDDEN",
          ),
        );
