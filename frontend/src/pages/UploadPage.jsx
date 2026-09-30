import { useRef, useState } from "react";
import {
  FileImage,
  FileText,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export default function UploadPage() {
  const input = useRef();
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const { push } = useToast();
  const nav = useNavigate();
  const choose = (candidate) => {
    if (!candidate) return;
    if (!allowed.includes(candidate.type))
      return push("Choose a PDF, PNG, JPEG, or WebP document.", "error");
    if (candidate.size > 10 * 1024 * 1024)
      return push("The maximum file size is 10 MB.", "error");
    setFile(candidate);
  };
  const upload = async () => {
    setBusy(true);
    setProgress(0);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await api.post("/documents", body, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) =>
          e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      push("Document uploaded securely.");
      nav(`/documents/${data.data.id}/processing`);
    } catch (e) {
      push(errorMessage(e), "error");
      setBusy(false);
      setProgress(null);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Secure intake"
        title="Upload a document"
        description="The file goes directly to private storage through the VeriFlow API. AI processing starts only after upload succeeds."
      />
      <section className="mx-auto max-w-4xl">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            choose(e.dataTransfer.files[0]);
          }}
          className={`card relative border-2 border-dashed p-8 text-center transition sm:p-14 ${drag ? "border-emerald-500 bg-emerald-50" : "border-slate-300"}`}
        >
          {file ? (
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                {file.type === "application/pdf" ? (
                  <FileText size={30} />
                ) : (
                  <FileImage size={30} />
                )}
              </div>
              <p className="mt-5 break-all font-display text-lg font-bold">
                {file.name}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
              </p>
              {progress != null && (
                <div className="mx-auto mt-6 max-w-md">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Uploading {progress}%
                  </p>
                </div>
              )}
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <button
                  disabled={busy}
                  className="btn-primary"
                  onClick={upload}
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <ShieldCheck size={17} />
                  )}
                  Upload securely
                </button>
                <button
                  disabled={busy}
                  className="btn-secondary"
                  onClick={() => {
                    setFile(null);
                    input.current.value = "";
                  }}
                >
                  <X size={17} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <UploadCloud size={30} />
              </div>
              <h2 className="mt-5 font-display text-xl font-bold">
                Drop a document here
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                or select a file from your device
              </p>
              <button
                className="btn-primary mt-6"
                onClick={() => input.current.click()}
              >
                Choose file
              </button>
              <p className="mt-5 text-xs text-slate-400">
                PDF, PNG, JPEG, or WebP · Maximum 10 MB
              </p>
            </div>
          )}
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => choose(e.target.files[0])}
          />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Private by default", "Files are never exposed with public URLs."],
            ["AI-ready formats", "PDF and common image formats supported."],
            ["Human in control", "Review and correct every extracted field."],
          ].map(([t, d]) => (
            <div className="rounded-2xl border bg-white p-4" key={t}>
              <p className="text-sm font-bold">{t}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
