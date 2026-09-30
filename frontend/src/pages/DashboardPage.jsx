import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Files,
  UploadCloud,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { date, money, title } from "../utils/format";
export default function DashboardPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [state, setState] = useState(null);
  useEffect(() => {
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/documents", { params: { pageSize: 5 } }),
    ])
      .then(([a, d]) =>
        setState({ analytics: a.data.data, documents: d.data.data.items }),
      )
      .catch((e) => push(errorMessage(e), "error"));
  }, [push]);
  if (!state) return <Loading label="Loading your workspace" />;
  const a = state.analytics;
  const cards = [
    ["Total documents", a.totalDocuments, Files, "bg-blue-50 text-blue-700"],
    [
      "Pending review",
      a.underReview + a.reviewRequested,
      Clock3,
      "bg-amber-50 text-amber-700",
    ],
    ["Approved", a.approved, CheckCircle2, "bg-emerald-50 text-emerald-700"],
    ["High risk", a.highRisk, AlertTriangle, "bg-red-50 text-red-700"],
  ];
  return (
    <>
      <PageHeader
        eyebrow="Workspace overview"
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${user.fullName?.split(" ")[0] || "there"}.`}
        description="Real-time visibility across processing, validation, and approvals."
        actions={
          <Link to="/upload" className="btn-primary">
            <UploadCloud size={17} />
            Upload document
          </Link>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, color]) => (
          <article className="card p-5" key={label}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <span className={`rounded-xl p-2.5 ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <p className="mt-5 font-display text-3xl font-extrabold">{value}</p>
          </article>
        ))}
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.9fr]">
        <article className="card min-h-[330px] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">
                Documents processed
              </h2>
              <p className="text-xs text-slate-400">Uploads over time</p>
            </div>
            <Link
              className="text-sm font-bold text-emerald-800"
              to="/analytics"
            >
              Full analytics
            </Link>
          </div>
          {a.documentsOverTime.length ? (
            <div className="mt-8 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a.documentsOverTime}>
                  <defs>
                    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#167154"
                        stopOpacity={0.35}
                      />
                      <stop offset="95%" stopColor="#167154" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    fontSize={11}
                  />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="documents"
                    stroke="#167154"
                    strokeWidth={2.5}
                    fill="url(#fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No processing history"
              description="Your document volume chart will build as real files are uploaded."
            />
          )}
        </article>
        <article className="card p-6">
          <h2 className="font-display text-lg font-bold">AI quality signal</h2>
          <p className="mt-1 text-xs text-slate-400">
            Across completed documents
          </p>
          <div className="mt-8 grid place-items-center">
            <div
              className="grid h-40 w-40 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#167154 ${a.averageConfidence * 100}%, #e5ece8 0)`,
              }}
            >
              <div className="grid h-32 w-32 place-items-center rounded-full bg-white text-center">
                <div>
                  <p className="font-display text-3xl font-extrabold">
                    {Math.round(a.averageConfidence * 100)}%
                  </p>
                  <p className="text-xs text-slate-400">avg. confidence</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-bold text-emerald-700">{a.lowRisk}</p>
              <p className="text-xs text-slate-400">Low risk</p>
            </div>
            <div>
              <p className="font-bold text-amber-600">{a.mediumRisk}</p>
              <p className="text-xs text-slate-400">Medium</p>
            </div>
            <div>
              <p className="font-bold text-red-600">{a.highRisk}</p>
              <p className="text-xs text-slate-400">High</p>
            </div>
          </div>
        </article>
      </section>
      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <h2 className="font-display text-lg font-bold">Recent documents</h2>
            <p className="text-xs text-slate-400">Your latest activity</p>
          </div>
          <Link
            className="flex items-center gap-1 text-sm font-bold text-emerald-800"
            to="/documents"
          >
            View all <ArrowRight size={15} />
          </Link>
        </div>
        {state.documents.length ? (
          <div className="divide-y">
            {state.documents.map((d) => (
              <Link
                key={d.id}
                to={`/documents/${d.id}`}
                className="grid gap-3 px-6 py-4 transition hover:bg-slate-50 md:grid-cols-[1fr_140px_120px_130px] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{d.originalName}</p>
                  <p className="truncate text-xs text-slate-400">
                    {d.vendorName ||
                      title(d.documentType || "Awaiting analysis")}{" "}
                    · {date(d.createdAt)}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {money(d.totalAmount, d.currency)}
                </p>
                <StatusBadge value={d.riskLevel} />
                <StatusBadge value={d.status} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Your document workspace is ready"
            description="Upload a real PDF or image to begin the intelligence pipeline."
            action={{ href: "/upload", label: "Upload first document" }}
          />
        )}
      </section>
      <section className="card mt-6 overflow-hidden">
        <div className="border-b px-6 py-5">
          <h2 className="font-display text-lg font-bold">Recent activity</h2>
          <p className="text-xs text-slate-400">
            Your latest recorded workflow events
          </p>
        </div>
        {a.recentActivity?.length ? (
          <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {a.recentActivity.map((item) => (
              <div className="flex gap-3 px-6 py-4" key={item.id}>
                <span className="mt-0.5 rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <Activity size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{title(item.action)}</p>
                  <p className="truncate text-xs text-slate-400">
                    {item.documents?.original_name || "Account activity"} ·{" "}
                    {date(item.created_at, true)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No activity yet"
            description="Uploads, processing, edits, and decisions will be recorded here."
          />
        )}
      </section>
    </>
  );
}
