import { ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
        Page not found
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={handleGoBack} className="btn-primary">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Go back to previous page
        </button>
        <Link to="/" className="btn-secondary">
          <Home aria-hidden="true" className="h-4 w-4" />
          Back to overview
        </Link>
      </div>
    </div>
  );
}
