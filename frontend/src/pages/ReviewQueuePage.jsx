import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3 } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { date, money } from "../utils/format";
export default function ReviewQueuePage() {
  const [data, setData] = useState(null);
  const { push } = useToast();
  useEffect(() => {
    Promise.all([
      api.get("/documents", {
        params: { status: "under_review", pageSize: 50 },
      }),
      api.get("/documents", {
        params: { status: "review_requested", pageSize: 50 },
      }),
    ])
      .then(([a, b]) =>
        setData(
          [...a.data.data.items, ...b.data.data.items].sort(
            (x, y) => new Date(x.createdAt) - new Date(y.createdAt),
          ),
        ),
      )
      .catch((e) => push(errorMessage(e), "error"));
  }, [push]);
  if (!data) return <Loading label="Loading review queue" />;
  return (
    <>
      <PageHeader
        eyebrow="Human oversight"
        title="Review queue"
        description="Documents awaiting a reviewer or administrator decision, oldest first."
      />
      {data.length ? (
        <div className="grid gap-4">
          {data.map((d) => (
            <Link
              key={d.id}
              to={`/documents/${d.id}`}
              className="card grid gap-4 p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
            >
              <div>
                <p className="font-display font-bold">{d.originalName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Owner: {d.users?.full_name || d.users?.email || "Unknown"} ·{" "}
                  {d.vendorName || "Vendor not extracted"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Amount</p>
                <p className="text-sm font-bold">
                  {money(d.totalAmount, d.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Risk</p>
                <StatusBadge value={d.riskLevel} />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock3 size={15} />
                {date(d.createdAt, true)}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title="The review queue is clear"
            description="Documents under review or explicitly escalated will appear here."
          />
        </div>
      )}
    </>
  );
}
