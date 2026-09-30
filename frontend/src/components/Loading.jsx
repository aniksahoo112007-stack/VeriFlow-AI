import { LoaderCircle } from "lucide-react";
export default function Loading({ label = "Loading" }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-slate-500">
      <LoaderCircle className="animate-spin text-emerald-700" size={28} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
