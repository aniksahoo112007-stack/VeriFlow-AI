import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
import { date } from "../utils/format";
export default function NotificationsPage() {
  const [data, setData] = useState(null);
  const { push } = useToast();
  const load = () =>
    api
      .get("/notifications")
      .then((r) => setData(r.data.data))
      .catch((e) => push(errorMessage(e), "error"));
  useEffect(() => {
    load();
  }, []);
  const read = async (item) => {
    if (item.read_at) return;
    try {
      await api.patch(`/notifications/${item.id}/read`);
      setData((v) =>
        v.map((x) =>
          x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x,
        ),
      );
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };
  if (!data) return <Loading label="Loading notifications" />;
  return (
    <>
      <PageHeader
        eyebrow="Activity center"
        title="Notifications"
        description="Real processing and workflow events from your documents."
      />
      {data.length ? (
        <div className="card divide-y overflow-hidden">
          {data.map((n) => (
            <div
              key={n.id}
              className={`flex gap-4 p-5 ${n.read_at ? "bg-white" : "bg-emerald-50/60"}`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <Bell size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{n.title}</p>
                  <p className="text-xs text-slate-400">
                    {date(n.created_at, true)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-500">{n.message}</p>
                <div className="mt-3 flex gap-3">
                  {n.document_id && (
                    <Link
                      className="text-xs font-bold text-emerald-800"
                      to={`/documents/${n.document_id}`}
                    >
                      Open document
                    </Link>
                  )}
                  {!n.read_at && (
                    <button
                      className="flex items-center gap-1 text-xs font-bold text-slate-500"
                      onClick={() => read(n)}
                    >
                      <CheckCheck size={14} />
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title="No notifications"
            description="Processing results and document decisions will appear here when they happen."
          />
        </div>
      )}
    </>
  );
}
