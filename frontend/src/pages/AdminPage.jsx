import { useEffect, useState } from "react";
import {
  Activity,
  FileStack,
  LoaderCircle,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
import { date, title } from "../utils/format";
export default function AdminPage() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState("");
  const { push } = useToast();
  const load = () =>
    Promise.all([
      api.get("/admin/users"),
      api.get("/admin/audit"),
      api.get("/analytics/overview"),
    ])
      .then(([u, a, o]) =>
        setState({
          users: u.data.data,
          audit: a.data.data,
          overview: o.data.data,
        }),
      )
      .catch((e) => push(errorMessage(e), "error"));
  useEffect(() => {
    load();
  }, []);
  const change = async (id, role) => {
    setBusy(id);
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      push("User role updated and audited.");
      await load();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setBusy("");
    }
  };
  if (!state) return <Loading label="Loading administration" />;
  return (
    <>
      <PageHeader
        eyebrow="System governance"
        title="Administration"
        description="Manage access roles and inspect real system activity."
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat icon={UsersRound} label="Users" value={state.users.length} />
        <Stat
          icon={FileStack}
          label="Documents"
          value={state.overview.totalDocuments}
        />
        <Stat
          icon={ShieldCheck}
          label="High-risk documents"
          value={state.overview.highRisk}
        />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <article className="card overflow-hidden">
          <div className="border-b px-6 py-5">
            <h2 className="font-display text-lg font-bold">Users and roles</h2>
            <p className="text-xs text-slate-400">
              Changes are recorded in the audit log
            </p>
          </div>
          {state.users.length ? (
            <div className="divide-y">
              {state.users.map((u) => (
                <div
                  key={u.id}
                  className="grid gap-3 px-6 py-4 sm:grid-cols-[1fr_160px] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {u.full_name || "Unnamed user"}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {u.email} · {title(u.auth_provider)}
                    </p>
                  </div>
                  <div className="relative">
                    {busy === u.id ? (
                      <div className="grid h-10 place-items-center">
                        <LoaderCircle
                          className="animate-spin text-emerald-700"
                          size={18}
                        />
                      </div>
                    ) : (
                      <select
                        aria-label={`Role for ${u.email}`}
                        className="input"
                        value={u.role}
                        onChange={(e) => change(u.id, e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No users"
              description="Registered accounts will appear here."
            />
          )}
        </article>
        <article className="card overflow-hidden">
          <div className="border-b px-6 py-5">
            <h2 className="font-display text-lg font-bold">
              Recent audit activity
            </h2>
            <p className="text-xs text-slate-400">Latest 100 recorded events</p>
          </div>
          {state.audit.length ? (
            <div className="max-h-[620px] divide-y overflow-y-auto">
              {state.audit.map((item) => (
                <div key={item.id} className="flex gap-3 px-5 py-4">
                  <span className="rounded-xl bg-slate-50 p-2 text-slate-500">
                    <Activity size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{title(item.action)}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {item.users?.email || "System"}
                      {item.documents?.original_name
                        ? ` · ${item.documents.original_name}`
                        : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-300">
                      {date(item.created_at, true)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No audit events"
              description="Security and workflow events will appear here."
            />
          )}
        </article>
      </section>
    </>
  );
}
function Stat({ icon: Icon, label, value }) {
  return (
    <article className="card flex items-center gap-4 p-5">
      <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
        <Icon />
      </span>
      <div>
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <p className="font-display text-2xl font-extrabold">{value}</p>
      </div>
    </article>
  );
}
