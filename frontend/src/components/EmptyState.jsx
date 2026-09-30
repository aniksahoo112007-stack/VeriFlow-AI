import { FileSearch } from "lucide-react";
import { Link } from "react-router-dom";
export default function EmptyState({
  title = "Nothing here yet",
  description = "Your real activity will appear here.",
  action,
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-emerald-50 p-4 text-emerald-700">
        <FileSearch size={28} />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action && (
        <Link className="btn-primary mt-5" to={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
