import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage, processDocument } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import Loading from "../components/Loading";
import StatusBadge from "../components/StatusBadge";
import { date, money, title } from "../utils/format";
const editable = [
  ["documentType", "Document type", "select"],
  ["vendorName", "Vendor", "text"],
  ["vendorAddress", "Vendor address", "text"],
  ["vendorPhone", "Vendor phone", "text"],
  ["vendorEmail", "Vendor email", "text"],
  ["documentNumber", "Document number", "text"],
  ["invoiceNumber", "Invoice number", "text"],
  ["receiptNumber", "Receipt number", "text"],
  ["purchaseOrderNumber", "PO number", "text"],
  ["utrNumber", "UTR number", "text"],
  ["transactionId", "Transaction ID", "text"],
  ["referenceNumber", "Reference number", "text"],
  ["documentDate", "Document date", "date"],
  ["transactionDate", "Transaction date", "date"],
  ["dueDate", "Due date", "date"],
  ["currency", "Currency", "text"],
  ["subtotal", "Subtotal", "number"],
  ["taxAmount", "Tax", "number"],
  ["gstAmount", "GST", "number"],
  ["cgst", "CGST", "number"],
  ["sgst", "SGST", "number"],
  ["igst", "IGST", "number"],
  ["discount", "Discount", "number"],
  ["totalAmount", "Total", "number"],
  ["paidAmount", "Paid amount", "number"],
  ["balanceAmount", "Balance amount", "number"],
  ["gstin", "GSTIN", "text"],
  ["pan", "PAN", "text"],
  ["bankName", "Bank", "text"],
  ["accountLast4", "Account last 4", "text"],
  ["paymentMethod", "Payment method", "text"],
];
const moneyFields = new Set(["subtotal", "taxAmount", "gstAmount", "cgst", "sgst", "igst", "discount", "totalAmount", "paidAmount", "balanceAmount"]);
const dateFields = new Set(["documentDate", "transactionDate", "dueDate"]);
export default function DocumentDetailPage() {
  const { id } = useParams();
  const { push } = useToast();
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState("");
  const [comment, setComment] = useState("");
  const retryRunning = useRef(false);
  const load = () =>
    api
      .get(`/documents/${id}`)
      .then((r) => {
        setData(r.data.data);
        setForm(
          Object.fromEntries(
            editable.map(([key]) => [key, r.data.data.document[key] ?? ""]),
          ),
        );
      })
      .catch((e) => push(errorMessage(e), "error"));
  useEffect(() => {
    load();
  }, [id]);
  const save = async () => {
    setBusy("save");
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, moneyFields.has(key) ? (value === "" ? null : Number(value)) : dateFields.has(key) ? value || null : value || null]));
      await api.patch(`/documents/${id}/extracted-fields`, payload);
      push("Extracted fields updated and revalidated.");
      setEdit(false);
      await load();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setBusy("");
    }
  };
  const decide = async (action) => {
    setBusy(action);
    try {
      await api.post(`/documents/${id}/review`, { action, comment });
      push(
        action === "approved"
          ? "Document approved."
          : action === "rejected"
            ? "Document rejected."
            : "Review requested.",
      );
      setComment("");
      await load();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setBusy("");
    }
  };
  const retry = async () => {
    if (retryRunning.current) return;
    retryRunning.current = true;
    setBusy("retry");
    try {
      await processDocument(id);
      push("Analysis completed.");
      await load();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      retryRunning.current = false;
      setBusy("");
    }
  };
  if (!data) return <Loading label="Loading document intelligence" />;
  const d = data.document;
  const failed = d.processingStatus === "failed";
  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Link
            className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink"
            to="/documents"
          >
            <ArrowLeft size={16} />
            Documents
          </Link>
          <h1 className="max-w-3xl break-words font-display text-2xl font-extrabold md:text-3xl">
            {d.originalName}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge value={d.status} />
            <StatusBadge value={d.processingStatus} />
            <StatusBadge value={d.riskLevel} />
          </div>
        </div>
        <div className="flex gap-2">
          {failed && (
            <button disabled={busy} className="btn-primary" onClick={retry}>
              {busy === "retry" ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <RefreshCw size={17} />
              )}
              Retry AI
            </button>
          )}
          <button
            className="btn-secondary"
            disabled={failed || d.processingStatus !== "completed"}
            onClick={() => setEdit((v) => !v)}
          >
            {edit ? <X size={17} /> : <Pencil size={17} />}{" "}
            {edit ? "Cancel" : "Correct fields"}
          </button>
        </div>
      </div>
      {failed && (
        <div className="mb-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="shrink-0" size={20} />
          <div>
            <p className="font-bold">Processing did not complete</p>
            <p className="mt-1">
              {d.processingError ||
                "The AI integration could not analyze this document."}{" "}
              The original upload remains available.
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,.92fr)]">
        <section className="card min-h-[620px] overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-display font-bold">Original document</h2>
              <p className="text-xs text-slate-400">Private signed preview</p>
            </div>
            {data.previewUrl && (
              <a
                className="btn-secondary px-3 py-2"
                href={data.previewUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                Open
              </a>
            )}
          </div>
          {data.previewUrl ? (
            d.mimeType === "application/pdf" ? (
              <iframe
                title="Document preview"
                className="h-[650px] w-full bg-slate-100"
                src={data.previewUrl}
              />
            ) : (
              <div className="flex min-h-[600px] items-center justify-center bg-slate-100 p-4">
                <img
                  className="max-h-[650px] max-w-full object-contain"
                  src={data.previewUrl}
                  alt={`Preview of ${d.originalName}`}
                />
              </div>
            )
          ) : (
            <div className="grid min-h-[600px] place-items-center text-center text-slate-400">
              <div>
                <FileText className="mx-auto" size={36} />
                <p className="mt-3 text-sm">Preview unavailable</p>
              </div>
            </div>
          )}
        </section>
        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Structured intelligence</p>
                <h2 className="mt-1 font-display text-xl font-bold">
                  Extracted information
                </h2>
              </div>
              {d.aiConfidence != null && (
                <div className="text-right">
                  <p className="font-display text-xl font-extrabold text-emerald-700">
                    {Math.round(d.aiConfidence * 100)}%
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500">Extraction Confidence</p>
                  <p className="text-[10px] text-slate-400">visible-field readability</p>
                </div>
              )}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {editable.map(([key, label, type]) => (
                <Field
                  key={key}
                  name={key}
                  label={label}
                  type={type}
                  edit={edit}
                  value={form[key]}
                  display={d[key]}
                  currency={d.currency}
                  onChange={(value) => setForm((v) => ({ ...v, [key]: value }))}
                />
              ))}
            </div>
            {d.summary && (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  AI summary
                </p>
                <p className="mt-2 text-sm leading-6">{d.summary}</p>
              </div>
            )}
            {(["visibleLogos", "visibleStamps", "visibleSignatures"]).some((key) => d.rawExtraction?.[key]?.length) && (
              <div className="mt-5 rounded-xl border p-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Visible document elements</p>
                {["visibleLogos", "visibleStamps", "visibleSignatures"].map((key) => d.rawExtraction?.[key]?.length ? <p className="mt-2" key={key}><span className="font-semibold">{title(key)}:</span> {d.rawExtraction[key].join(", ")}</p> : null)}
              </div>
            )}
            {edit && (
              <button
                disabled={busy === "save"}
                className="btn-primary mt-5 w-full"
                onClick={save}
              >
                {busy === "save" ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <Save size={17} />
                )}
                Save and revalidate
              </button>
            )}
          </section>
          <LineItems items={d.lineItems} />
          <ValidationPanel
            items={data.validations}
            score={d.riskScore}
            level={d.riskLevel}
          />
          <section className="card p-5">
            <p className="eyebrow">Decision</p>
            <h2 className="mt-1 font-display text-xl font-bold">
              Human review
            </h2>
            <textarea
              className="input mt-4 min-h-20 resize-y"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add an optional decision note…"
              maxLength={1000}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                disabled={!!busy}
                className="btn-primary bg-emerald-700 hover:bg-emerald-800"
                onClick={() => decide("approved")}
              >
                <Check size={17} />
                Approve
              </button>
              <button
                disabled={!!busy}
                className="btn-secondary border-amber-200 text-amber-700"
                onClick={() => decide("review_requested")}
              >
                <ShieldAlert size={17} />
                Request review
              </button>
              <button
                disabled={!!busy}
                className="btn-secondary border-red-200 text-red-700"
                onClick={() => decide("rejected")}
              >
                <X size={17} />
                Reject
              </button>
            </div>
            {data.approvals.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Decision history
                </p>
                {data.approvals.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className="mt-3 flex items-start justify-between gap-3 text-sm"
                  >
                    <div>
                      <span className="font-semibold">
                        {a.users?.full_name || a.users?.email || "User"}
                      </span>{" "}
                      <span className="text-slate-500">{title(a.action)}</span>
                      {a.comment && (
                        <p className="mt-1 text-xs text-slate-400">
                          {a.comment}
                        </p>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-xs text-slate-400">
                      {date(a.createdAt, true)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
function Field({
  name,
  label,
  type,
  edit,
  value,
  display,
  currency,
  onChange,
}) {
  if (edit)
    return (
      <label>
        <span className="label text-xs">{label}</span>
        {type === "select" ? (
          <select
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {[
              "invoice",
              "purchase_order",
              "receipt",
              "payment",
              "expense_bill",
              "form",
              "contract",
              "other",
            ].map((x) => (
              <option key={x} value={x}>
                {title(x)}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input"
            type={type}
            step={type === "number" ? "0.01" : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </label>
    );
  const formatted = moneyFields.has(name)
    ? money(display, currency)
    : dateFields.has(name)
      ? date(display)
      : name === "documentType"
        ? title(display || "—")
        : display || "—";
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold">{formatted}</p>
    </div>
  );
}
function LineItems({ items = [] }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b px-5 py-4">
        <h2 className="font-display font-bold">Line items</h2>
      </div>
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Unit price</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((x, i) => (
                <tr key={`${x.description}-${i}`}>
                  <td className="px-4 py-3 font-medium">{x.description}</td>
                  <td className="px-4 py-3">{x.quantity ?? "—"}</td>
                  <td className="px-4 py-3">{x.unitPrice ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{x.amount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-5 text-sm text-slate-400">
          No line items were confidently extracted.
        </p>
      )}
    </section>
  );
}
function ValidationPanel({ items = [], score, level }) {
  const failed = items.filter((x) => !x.passed);
  return (
    <section className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">Document risk</p>
          <h2 className="mt-1 font-display text-xl font-bold">
            Document Risk: {title(level || "Not assessed")} ({score ?? 0}/100)
          </h2>
        </div>
        <StatusBadge value={level} />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Risk Factors</p>
      <div className="mt-3 space-y-3">
        {failed.length ? (
          failed.map((x) => (
            <div
              key={x.id || x.code}
              className="flex gap-3 rounded-xl bg-amber-50 p-3"
            >
              {x.severity === "critical" ? (
                <XCircle className="shrink-0 text-red-600" size={19} />
              ) : (
                <AlertTriangle className="shrink-0 text-amber-600" size={19} />
              )}
              <div>
                <p className="text-sm font-bold">{x.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {x.description}
                </p>
                {x.expectedValue && (
                  <p className="mt-1 text-xs">
                    Expected {x.expectedValue} · Actual {x.actualValue}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">
            {items.length ? "No suspicious evidence was found." : "Validation will appear after successful processing."}
          </p>
        )}
      </div>
      {failed.length === 0 && items.length > 0 && (
        <p className="mt-4 text-xs text-emerald-700">
          All recorded deterministic checks passed.
        </p>
      )}
    </section>
  );
}
