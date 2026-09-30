import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import { title } from "../utils/format";
export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const nav = useNavigate();
  const signOut = async () => {
    await logout();
    push("You have been signed out.");
    nav("/");
  };
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile & settings"
        description="Your authenticated VeriFlow identity and session controls."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-xl font-extrabold text-emerald-800">
              {user.fullName?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">
                {user.fullName}
              </h2>
              <p className="text-sm text-slate-400">{user.email}</p>
            </div>
          </div>
          <dl className="mt-7 grid gap-4 border-t pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-slate-400">Role</dt>
              <dd className="mt-1 text-sm font-bold">{title(user.role)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-400">
                Sign-in method
              </dt>
              <dd className="mt-1 text-sm font-bold">
                {title(user.authProvider)}
              </dd>
            </div>
          </dl>
        </section>
        <section className="card p-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <ShieldCheck />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">Secure session</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Access uses a short-lived token. Your refresh credential is kept
                in an HTTP-only cookie and revoked when you sign out.
              </p>
            </div>
          </div>
          <button className="btn-secondary mt-7 text-red-700" onClick={signOut}>
            <LogOut size={17} />
            Sign out of VeriFlow
          </button>
        </section>
      </div>
    </>
  );
}
