import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, UploadCloud } from "lucide-react";
import { api, errorMessage } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { date, money, title } from "../utils/format";
export default function DocumentsPage() {
  const { push } = useToast();
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    processingStatus: "",
    documentType: "",
    risk: "",
    sort: "newest",
    page: 1,
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .get("/documents", { params: { ...filters, pageSize: 10 } })
        .then((r) => setData(r.data.data))
        .catch((e) => push(errorMessage(e), "error"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters, push]);
  const update = (key, value) =>
    setFilters((v) => ({
      ...v,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  return (
    <>
      <PageHeader
        eyebrow="Document registry"
        title="Documents"
        description="Search, filter, and inspect every document in your authorized workflow."
        actions={
          <Link className="btn-primary" to="/upload">
            <UploadCloud size={17} />
            Upload
          </Link>
        }
      />
      <div className="card mb-5 grid gap-3 p-4 md:grid-cols-[1fr_repeat(4,auto)]">
        <label className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input
            aria-label="Search documents"
            className="input pl-10"
            placeholder="Search name, vendor, number, PO…"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </label>
        <Select
          value={filters.status}
          onChange={(e) => update("status", e.target.value)}
          label="All statuses"
          options={[
            "uploaded",
            "under_review",
            "approved",
            "rejected",
            "review_requested",
          ]}
        />
        <Select
          value={filters.documentType}
          onChange={(e) => update("documentType", e.target.value)}
          label="All types"
          options={[
            "invoice",
            "purchase_order",
            "receipt",
            "expense_bill",
            "form",
            "contract",
            "other",
          ]}
        />
        <Select
          value={filters.risk}
          onChange={(e) => update("risk", e.target.value)}
          label="All risk"
          options={["low", "medium", "high"]}
        />
        <Select
          value={filters.sort}
          onChange={(e) => update("sort", e.target.value)}
          label="Newest first"
          options={["oldest"]}
          optionLabels={{ oldest: "Oldest first" }}
        />
      </div>
      {loading ? (
        <Loading label="Loading documents" />
      ) : data?.items.length ? (
        <>
          <div className="card overflow-hidden">
            <div className="hidden grid-cols-[minmax(240px,1fr)_150px_140px_110px_120px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid">
              <span>Document</span>
              <span>Total</span>
              <span>Risk</span>
              <span>Processing</span>
              <span>Status</span>
            </div>
            <div className="divide-y">
              {data.items.map((d) => (
                <Link
                  key={d.id}
                  to={`/documents/${d.id}`}
                  className="grid gap-3 px-5 py-4 hover:bg-slate-50 md:grid-cols-[minmax(240px,1fr)_150px_140px_110px_120px] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {d.originalName}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {d.vendorName || title(d.documentType || "Unclassified")}{" "}
                      · {date(d.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {money(d.totalAmount, d.currency)}
                  </p>
                  <StatusBadge value={d.riskLevel} />
                  <StatusBadge value={d.processingStatus} />
                  <StatusBadge value={d.status} />
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <p>
              {data.pagination.total} document
              {data.pagination.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary px-3"
                disabled={filters.page <= 1}
                onClick={() => update("page", filters.page - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <span className="font-semibold">
                {filters.page} / {Math.max(1, data.pagination.pages)}
              </span>
              <button
                className="btn-secondary px-3"
                disabled={filters.page >= data.pagination.pages}
                onClick={() => update("page", filters.page + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="No documents found"
            description="Adjust the filters or upload the first document for this workspace."
            action={{ href: "/upload", label: "Upload document" }}
          />
        </div>
      )}
    </>
  );
}
function Select({ label, options, optionLabels = {}, ...props }) {
  return (
    <select className="input min-w-36" aria-label={label} {...props}>
      <option value={label === "Newest first" ? "newest" : ""}>{label}</option>
      {options.map((x) => (
        <option key={x} value={x}>
          {optionLabels[x] || title(x)}
        </option>
      ))}
    </select>
  );
}
