import { Component } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw, Home } from "lucide-react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
          goBack: this.handleGoBack,
        });
      }

      return (
        <div className="mx-auto max-w-xl py-12 px-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Something went wrong loading this view
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {this.state.error?.message ||
              "An unexpected error occurred while rendering this page."}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleGoBack}
              className="btn-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back to previous page
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <a href="/" className="btn-secondary">
              <Home className="h-4 w-4" />
              Return to overview
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
