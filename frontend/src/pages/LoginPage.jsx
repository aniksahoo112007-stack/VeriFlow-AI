import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import AuthShell from "../components/AuthShell";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { errorMessage } from "../api/client";
export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(form);
      push("Welcome back.");
      nav(loc.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your secure document workspace."
      footer={
        <>
          New to VeriFlow?{" "}
          <Link className="font-bold text-emerald-800" to="/signup">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
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
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button disabled={busy} className="btn-primary w-full" type="submit">
          {busy && <LoaderCircle className="animate-spin" size={17} />}Sign in
        </button>
      </form>
      <GoogleAuthButton />
    </AuthShell>
  );
}
