import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronLeft,
  FileCheck2,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UploadCloud,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "Documents", icon: Files },
  { to: "/upload", label: "Upload", icon: UploadCloud },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
];
export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const nav = [...baseNav];
  if (["reviewer", "admin"].includes(user.role))
    nav.splice(3, 0, {
      to: "/review",
      label: "Review queue",
      icon: FileCheck2,
    });
  if (user.role === "admin")
    nav.splice(nav.length - 1, 0, {
      to: "/admin",
      label: "Administration",
      icon: UsersRound,
    });
  const signOut = async () => {
    await logout();
    push("You have been signed out.");
    navigate("/");
  };
  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur lg:hidden">
        <button
          className="rounded-lg p-2"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
        >
          <Menu />
        </button>
        <Brand compact />
        <div className="w-10" />
      </header>
      {open && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-[#0c1d17] p-5 text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <Brand />
          <button
            className="p-2 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <p className="mt-8 px-3 text-[11px] font-bold uppercase tracking-[.18em] text-white/40">
          Workspace
        </p>
        <nav className="mt-3 flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? "bg-white text-ink" : "text-white/65 hover:bg-white/10 hover:text-white"}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-2xl bg-white/7 p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint font-bold text-ink">
              {user.fullName?.[0]?.toUpperCase() || "V"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
              <p className="truncate text-xs text-white/45">{user.role}</p>
            </div>
            <button
              aria-label="Sign out"
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
              onClick={signOut}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-h-screen lg:pl-72">
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-ink">
        <ShieldCheck size={20} />
      </div>
      {!compact && (
        <div>
          <div className="font-display text-base font-extrabold tracking-tight">
            VeriFlow <span className="text-mint">AI</span>
          </div>
          <div className="text-[10px] uppercase tracking-[.16em] text-white/35">
            Document Intelligence
          </div>
        </div>
      )}
    </div>
  );
}
