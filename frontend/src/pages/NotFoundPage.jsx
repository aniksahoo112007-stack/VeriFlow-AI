import { Link } from "react-router-dom";
export default function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream p-5 text-center">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold">
          This page is not in the flow.
        </h1>
        <p className="mt-3 text-slate-500">
          The address may have changed or no longer exists.
        </p>
        <Link className="btn-primary mt-6" to="/">
          Return home
        </Link>
      </div>
    </div>
  );
}
