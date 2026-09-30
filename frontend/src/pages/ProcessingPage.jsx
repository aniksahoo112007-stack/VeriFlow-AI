import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileScan,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { errorMessage, processDocument } from "../api/client";
import { useToast } from "../contexts/ToastContext";
const stages = [
  "Securing file",
  "Reading document",
  "Extracting information",
  "Validating fields",
  "Checking anomalies",
  "Generating risk assessment",
  "Finalizing analysis",
];
export default function ProcessingPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { push } = useToast();
  const [started] = useState(Date.now());
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const running = useRef(false);
  const process = async () => {
    if (running.current) return;
    running.current = true;
    setError("");
    setStage(0);
    const timer = setInterval(
      () => setStage((v) => Math.min(stages.length - 2, v + 1)),
      1100,
    );
    try {
      await processDocument(id);
      setStage(stages.length - 1);
      clearInterval(timer);
      push("AI analysis complete.");
      setTimeout(() => nav(`/documents/${id}`, { replace: true }), 500);
    } catch (e) {
      clearInterval(timer);
      setError(errorMessage(e));
      running.current = false;
      push(errorMessage(e), "error");
    }
  };
  useEffect(() => {
    process();
  }, []);
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-3xl items-center justify-center">
      <div className="card w-full p-7 sm:p-10">
        <div className="text-center">
          <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[#0c1d17] text-mint">
            <Sparkles size={34} />
            {!error && (
              <span className="absolute inset-0 animate-ping rounded-3xl border border-emerald-400/40" />
            )}
          </div>
          <p className="eyebrow mt-6">VeriFlow intelligence pipeline</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">
            {error ? "Analysis needs attention" : "Understanding your document"}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
            {error ||
              "Gemini is reading the original file while VeriFlow prepares deterministic validation and risk checks. No values are invented."}
          </p>
        </div>
        {!error ? (
          <div className="mx-auto mt-9 max-w-xl space-y-2">
            {stages.map((label, i) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${i === stage ? "bg-emerald-50 text-emerald-900" : i < stage ? "text-emerald-700" : "text-slate-300"}`}
              >
                {i < stage ? (
                  <CheckCircle2 size={19} />
                ) : i === stage ? (
                  <LoaderCircle className="animate-spin" size={19} />
                ) : (
                  <span className="h-[19px] w-[19px] rounded-full border-2" />
                )}
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 flex justify-center gap-3">
            <button className="btn-primary" onClick={process}>
              <Sparkles size={17} />
              Retry analysis
            </button>
            <Link className="btn-secondary" to={`/documents/${id}`}>
              Review upload
            </Link>
          </div>
        )}
        <div className="mt-8 flex items-center justify-center gap-2 border-t pt-5 text-xs text-slate-400">
          <ShieldCheck size={14} />
          Original document retained securely throughout processing
        </div>
      </div>
    </div>
  );
}
