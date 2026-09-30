import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, errorMessage } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
import { title } from "../utils/format";
const colors = [
  "#167154",
  "#e0a11c",
  "#dc4444",
  "#627d98",
  "#7c5ce7",
  "#0891b2",
];
export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const { push } = useToast();
  useEffect(() => {
    api
      .get("/analytics/overview")
      .then((r) => setData(r.data.data))
      .catch((e) => push(errorMessage(e), "error"));
  }, [push]);
  if (!data) return <Loading label="Building real analytics" />;
  const has = data.totalDocuments > 0;
  return (
    <>
      <PageHeader
        eyebrow="Operational intelligence"
        title="Analytics"
        description="Database-derived metrics only—no synthetic history or estimated volumes."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Processed", data.processedDocuments],
          ["Approval rate", `${Math.round(data.approvalRate * 100)}%`],
          ["AI confidence", `${Math.round(data.averageConfidence * 100)}%`],
          [
            "Avg. processing",
            data.averageProcessingSeconds == null
              ? "—"
              : `${Math.round(data.averageProcessingSeconds)}s`,
          ],
        ].map(([label, value]) => (
          <article key={label} className="card p-5">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-4 font-display text-3xl font-extrabold">{value}</p>
          </article>
        ))}
      </section>
      {has ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Chart title="Documents over time">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.documentsOverTime}>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                />
                <Tooltip />
                <Area
                  dataKey="documents"
                  stroke="#167154"
                  fill="#d8f3e7"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Chart>
          <Chart title="Document types">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.documentsByType.map((x) => ({
                  ...x,
                  name: title(x.name),
                }))}
              >
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  fontSize={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#167154" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Chart>
          <Chart title="Risk distribution">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.riskDistribution
                    .filter((x) => x.name !== "unknown")
                    .map((x) => ({ ...x, name: title(x.name) }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {data.riskDistribution.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Chart>
          <article className="card p-6">
            <h2 className="font-display text-lg font-bold">
              Workflow outcomes
            </h2>
            <div className="mt-7 space-y-5">
              <Metric
                label="Approved"
                value={data.approved}
                total={data.totalDocuments}
                color="bg-emerald-500"
              />
              <Metric
                label="Under review"
                value={data.underReview}
                total={data.totalDocuments}
                color="bg-violet-500"
              />
              <Metric
                label="Review requested"
                value={data.reviewRequested}
                total={data.totalDocuments}
                color="bg-amber-500"
              />
              <Metric
                label="Rejected"
                value={data.rejected}
                total={data.totalDocuments}
                color="bg-red-500"
              />
            </div>
          </article>
        </section>
      ) : (
        <div className="card mt-6">
          <EmptyState
            title="Analytics starts with real documents"
            description="Upload and process a document to begin building operational trends."
            action={{ href: "/upload", label: "Upload document" }}
          />
        </div>
      )}
    </>
  );
}
function Chart({ title, children }) {
  return (
    <article className="card p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-5 h-72">{children}</div>
    </article>
  );
}
function Metric({ label, value, total, color }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-slate-400">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
