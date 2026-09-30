import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, LoaderCircle } from "lucide-react";
import AuthShell from "../components/AuthShell";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { errorMessage } from "../api/client";
export default function SignupPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const valid =
    /[a-z]/.test(form.password) &&
    /[A-Z]/.test(form.password) &&
    /\d/.test(form.password) &&
    form.password.length >= 8;
  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm)
      return push("Passwords do not match.", "error");
    if (!valid)
      return push(
        "Use at least 8 characters with upper, lower, and number.",
        "error",
      );
    setBusy(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      });
      push("Your account is ready.");
      nav("/dashboard");
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell
      title="Create your account"
      description="Start a secure, auditable document workflow."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-bold text-emerald-800" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <label>
          <span className="label">Full name</span>
          <input
            className="input"
            autoComplete="name"
            required
            minLength={2}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </label>
        <label>
          <span className="label">Email address</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <label>
          <span className="label">Confirm password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </label>
        <p
          className={`flex items-center gap-2 text-xs ${valid ? "text-emerald-700" : "text-slate-400"}`}
        >
          <Check size={14} />
          8+ characters with uppercase, lowercase, and number
        </p>
        <button disabled={busy} className="btn-primary w-full" type="submit">
          {busy && <LoaderCircle className="animate-spin" size={17} />}Create
          account
        </button>
      </form>
      <GoogleAuthButton />
    </AuthShell>
  );
}
