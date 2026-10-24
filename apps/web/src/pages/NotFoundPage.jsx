import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        Page not found
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        This route is not part of the M01 foundation. Return to the overview to
        inspect the current milestone scope.
      </p>
      <Link to="/" className="btn-primary mt-6">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to overview
      </Link>
    </div>
  );
}
