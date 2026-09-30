import { Link, Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
export default function AuthShell({ title, description, children, footer }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="hidden bg-[#07120f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-ink">
            <ShieldCheck />
          </div>
          <span className="font-display text-lg font-extrabold">
            VeriFlow AI
          </span>
        </Link>
        <div>
          <p className="eyebrow text-mint">Trusted document decisions</p>
          <h2 className="mt-4 max-w-lg font-display text-5xl font-extrabold leading-tight">
            Every field traceable. Every decision accountable.
          </h2>
          <p className="mt-5 max-w-lg leading-7 text-white/50">
            Securely turn invoices, purchase orders, receipts, and forms into
            structured, reviewed intelligence.
          </p>
        </div>
        <p className="text-xs text-white/30">
          AI-assisted · Human-approved · Audit-ready
        </p>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-10 flex items-center gap-2 font-display font-extrabold lg:hidden"
          >
            <ShieldCheck className="text-emerald-700" /> VeriFlow AI
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-7 text-center text-sm text-slate-500">{footer}</p>
        </div>
      </div>
    </div>
  );
}
