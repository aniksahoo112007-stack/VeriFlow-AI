import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileScan,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";
const features = [
  {
    icon: FileScan,
    title: "Multimodal extraction",
    text: "Turn PDFs and images into validated, editable business data.",
  },
  {
    icon: BrainCircuit,
    title: "Explainable intelligence",
    text: "AI reads the document; deterministic checks decide what needs attention.",
  },
  {
    icon: Workflow,
    title: "Human approval workflow",
    text: "Approve, reject, or request review with a complete audit trail.",
  },
];
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07120f] text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-ink">
            <ShieldCheck />
          </div>
          <span className="font-display text-lg font-extrabold">
            VeriFlow <span className="text-mint">AI</span>
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white/70 hover:text-white"
            to="/login"
          >
            Sign in
          </Link>
          <Link
            className="rounded-xl bg-mint px-4 py-2 text-sm font-bold text-ink"
            to="/signup"
          >
            Get started
          </Link>
        </nav>
      </header>
      <main>
        <section className="relative overflow-hidden px-5 pb-24 pt-20 text-center">
          <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative mx-auto max-w-5xl">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[.15em] text-mint">
              <Sparkles size={14} /> Document intelligence, governed
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-.04em] sm:text-7xl">
              From raw documents to{" "}
              <span className="text-mint">trusted decisions.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-white/60">
              VeriFlow classifies, extracts, validates, and routes business
              documents through an auditable human review workflow.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-mint px-6 py-3.5 font-bold text-ink"
              >
                Start processing <ArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-white/15 px-6 py-3.5 font-bold"
              >
                Open workspace
              </Link>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="rounded-3xl border border-white/10 bg-white/[.045] p-7"
            >
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint">
                <Icon />
              </div>
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">{text}</p>
            </article>
          ))}
        </section>
        <section className="border-y border-white/10 bg-white/[.025]">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center">
            <div>
              <p className="eyebrow text-mint">The VeriFlow pipeline</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold">
                AI speed, deterministic control.
              </h2>
              <p className="mt-4 leading-7 text-white/55">
                The original file remains private. Gemini extracts supported
                facts, the backend applies repeatable validation, and people
                retain the final decision.
              </p>
            </div>
            <ol className="space-y-3">
              {[
                "Secure upload to private storage",
                "Multimodal AI classification and extraction",
                "Rule-based validation and risk assessment",
                "Human approval with audit history",
              ].map((x, i) => (
                <li
                  key={x}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/10 p-4"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-mint font-bold text-ink">
                    {i + 1}
                  </span>
                  <span className="font-semibold">{x}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-5 rounded-3xl bg-mint p-8 text-ink md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 font-bold">
                <LockKeyhole size={18} /> Built for sensitive business workflows
              </div>
              <h2 className="mt-3 font-display text-3xl font-extrabold">
                Private files. Scoped access. Clear accountability.
              </h2>
            </div>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 font-bold text-white"
              to="/signup"
            >
              Create workspace <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10 px-5 py-7 text-center text-xs text-white/35">
        © {new Date().getFullYear()} VeriFlow AI · Intelligent document
        processing
      </footer>
    </div>
  );
}
