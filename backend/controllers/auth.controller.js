import * as auth from "../services/auth.service.js";
import {
  registerSchema,
  loginSchema,
  googleSchema,
} from "../validators/auth.validators.js";

const setSession = (res, session, status = 200) => {
  res.cookie("vf_refresh", session.refreshToken, auth.cookieOptions());
  res
    .status(status)
    .json({
      success: true,
      data: { accessToken: session.accessToken, user: session.user },
    });
};

export async function register(req, res) {
  setSession(res, await auth.register(registerSchema.parse(req.body)), 201);
}
export async function login(req, res) {
  setSession(res, await auth.login(loginSchema.parse(req.body)));
}
export async function google(req, res) {
  setSession(
    res,
    await auth.googleLogin(googleSchema.parse(req.body).credential),
  );
}
export async function refresh(req, res) {
  setSession(res, await auth.refreshSession(req.cookies.vf_refresh));
}
export async function logout(req, res) {
  await auth.logout(req.cookies.vf_refresh);
  res.clearCookie("vf_refresh", auth.cookieOptions());
  res.json({ success: true, message: "Signed out." });
}
export async function me(req, res) {
  res.json({ success: true, data: await auth.getUser(req.user.sub) });
}
