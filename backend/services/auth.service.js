import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { getSupabase } from "../config/supabase.js";
import { env, hasJwtConfig } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";
import { writeAudit } from "./audit.service.js";

const googleClient = new OAuth2Client();
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const normalizeUser = (row) => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  avatarUrl: row.avatar_url,
  role: row.role,
  authProvider: row.auth_provider,
});

function ensureJwt() {
  if (!hasJwtConfig())
    throw new ApiError(
      503,
      "Authentication is not configured. Add the JWT secrets.",
      "AUTH_NOT_CONFIGURED",
    );
}

function accessTokenFor(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.full_name },
    env.accessSecret,
    { algorithm: "HS256", expiresIn: env.accessExpiresIn },
  );
}

async function issueSession(user) {
  ensureJwt();
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await getSupabase()
    .from("refresh_tokens")
    .insert({
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at: expiresAt,
    });
  if (error)
    throw new ApiError(
      500,
      "Could not create a secure session.",
      "SESSION_CREATE_FAILED",
    );
  return {
    accessToken: accessTokenFor(user),
    refreshToken,
    user: normalizeUser(user),
  };
}

export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
});

export async function register({ fullName, email, password }) {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing)
    throw new ApiError(
      409,
      "An account already exists for this email.",
      "EMAIL_EXISTS",
    );
  const role = env.adminEmails.includes(email) ? "admin" : "user";
  const { data: user, error } = await supabase
    .from("users")
    .insert({
      email,
      full_name: fullName,
      password_hash: await bcrypt.hash(password, 12),
      auth_provider: "local",
      role,
    })
    .select()
    .single();
  if (error)
    throw new ApiError(500, "Account creation failed.", "REGISTER_FAILED");
  await writeAudit({ userId: user.id, action: "USER_REGISTERED" });
  return issueSession(user);
}

export async function login({ email, password }) {
  const { data: user } = await getSupabase()
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (
    !user?.password_hash ||
    !(await bcrypt.compare(password, user.password_hash))
  )
    throw new ApiError(
      401,
      "Email or password is incorrect.",
      "INVALID_CREDENTIALS",
    );
  if (env.adminEmails.includes(email) && user.role !== "admin") {
    const { data } = await getSupabase()
      .from("users")
      .update({ role: "admin" })
      .eq("id", user.id)
      .select()
      .single();
    Object.assign(user, data);
  }
  await writeAudit({ userId: user.id, action: "USER_LOGIN" });
  return issueSession(user);
}

export async function googleLogin(credential) {
  if (!env.googleClientId)
    throw new ApiError(
      503,
      "Google Sign-In is not configured.",
      "GOOGLE_NOT_CONFIGURED",
    );
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(
      401,
      "Google credential could not be verified.",
      "INVALID_GOOGLE_CREDENTIAL",
    );
  }
  if (!payload?.email || !payload.email_verified)
    throw new ApiError(
      401,
      "A verified Google email is required.",
      "UNVERIFIED_GOOGLE_EMAIL",
    );
  const email = payload.email.toLowerCase();
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  const role = env.adminEmails.includes(email)
    ? "admin"
    : existing?.role || "user";
  let user;
  if (existing) {
    const { data, error } = await supabase
      .from("users")
      .update({
        full_name: payload.name || existing.full_name,
        avatar_url: payload.picture || existing.avatar_url,
        google_subject: payload.sub,
        role,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error)
      throw new ApiError(
        500,
        "Google account could not be updated.",
        "GOOGLE_LOGIN_FAILED",
      );
    user = data;
  } else {
    const { data, error } = await supabase
      .from("users")
      .insert({
        email,
        full_name: payload.name || email.split("@")[0],
        avatar_url: payload.picture,
        auth_provider: "google",
        google_subject: payload.sub,
        role,
      })
      .select()
      .single();
    if (error)
      throw new ApiError(
        500,
        "Google account could not be created.",
        "GOOGLE_LOGIN_FAILED",
      );
    user = data;
  }
  await writeAudit({ userId: user.id, action: "GOOGLE_LOGIN" });
  return issueSession(user);
}

export async function refreshSession(rawToken) {
  ensureJwt();
  if (!rawToken)
    throw new ApiError(401, "Refresh session is missing.", "NO_REFRESH_TOKEN");
  const supabase = getSupabase();
  const { data: stored } = await supabase
    .from("refresh_tokens")
    .select("*, users(*)")
    .eq("token_hash", hashToken(rawToken))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!stored?.users)
    throw new ApiError(
      401,
      "Refresh session is invalid or expired.",
      "INVALID_REFRESH_TOKEN",
    );
  await supabase
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", stored.id);
  return issueSession(stored.users);
}

export async function logout(rawToken) {
  if (!rawToken) return;
  await getSupabase()
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashToken(rawToken))
    .is("revoked_at", null);
}

export async function getUser(userId) {
  const { data, error } = await getSupabase()
    .from("users")
    .select("id,email,full_name,avatar_url,role,auth_provider,created_at")
    .eq("id", userId)
    .single();
  if (error) throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  return normalizeUser(data);
}
