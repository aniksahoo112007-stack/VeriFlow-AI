import { title } from "../utils/format";
const colors = {
  approved: "bg-emerald-50 text-emerald-700",
  completed: "bg-emerald-50 text-emerald-700",
  low: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  failed: "bg-red-50 text-red-700",
  high: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  medium: "bg-amber-50 text-amber-700",
  under_review: "bg-violet-50 text-violet-700",
  review_requested: "bg-orange-50 text-orange-700",
  uploaded: "bg-slate-100 text-slate-700",
};
export default function StatusBadge({ value }) {
  return value ? (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${colors[value] || "bg-slate-100 text-slate-700"}`}
    >
      {title(value)}
    </span>
  ) : (
    <span className="text-slate-400">—</span>
  );
}
