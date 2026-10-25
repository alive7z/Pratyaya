import { Component } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw, Home } from "lucide-react";
import { cn } from "../lib/utils.js";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (state.hasError && props.resetKey !== state.resetKey) {
      return {
        hasError: false,
        error: null,
        resetKey: props.resetKey,
      };
    }

    return null;
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", {
      error,
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });

    this.props.onReset?.();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    if (window.history.state?.idx > 0) {
      window.history.back();
    } else {
      window.location.assign("/");
    }
  };

  render() {
    const { hasError, error } = this.state;

    if (!hasError) {
      return this.props.children;
    }

    const {
      fallback,
      title = "Something went wrong",
      description = "We couldn't load this view. Please try again or return to the overview.",
      showErrorDetails = import.meta.env.DEV,
    } = this.props;

    const fallbackActions = {
      error,
      reset: this.handleReset,
      reload: this.handleReload,
      goBack: this.handleGoBack,
    };

    if (fallback) {
      return typeof fallback === "function"
        ? fallback(fallbackActions)
        : fallback;
    }

    return (
      <main
        role="main"
        className={cn(
          "flex min-h-[60vh] w-full items-center justify-center",
          "px-4 py-12 sm:px-6",
        )}
      >
        <section
          aria-labelledby="error-boundary-title"
          className={cn(
            "w-full max-w-xl rounded-2xl border",
            "border-slate-200 bg-white p-6",
            "text-center shadow-sm",
            "dark:border-slate-800 dark:bg-slate-950",
            "sm:p-10",
          )}
        >
          <div
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center",
              "rounded-2xl bg-amber-50 text-amber-600",
              "dark:bg-amber-950/40 dark:text-amber-400",
            )}
          >
            <AlertTriangle
              className="h-8 w-8"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <h1
            id="error-boundary-title"
            className={cn(
              "mt-6 text-2xl font-bold tracking-tight",
              "text-slate-950 dark:text-white",
              "sm:text-3xl",
            )}
          >
            {title}
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {description}
          </p>

          {showErrorDetails && error && (
            <details
              className={cn(
                "mt-6 rounded-xl border text-left",
                "border-red-200 bg-red-50/60",
                "dark:border-red-900 dark:bg-red-950/20",
              )}
            >
              <summary
                className={cn(
                  "cursor-pointer px-4 py-3",
                  "text-sm font-medium text-red-700",
                  "dark:text-red-300",
                  "focus-visible:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-red-500",
                  "rounded-lg",
                )}
              >
                Technical error details
              </summary>

              <div className="border-t border-red-200 px-4 py-3 dark:border-red-900">
                <pre
                  className={cn(
                    "max-h-48 overflow-auto whitespace-pre-wrap",
                    "wrap-break-word font-mono text-xs leading-relaxed",
                    "text-red-700 dark:text-red-300",
                  )}
                >
                  {error.stack || error.message || String(error)}
                </pre>
              </div>
            </details>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2",
                "rounded-lg bg-blue-600 px-5",
                "text-sm font-medium text-white",
                "transition-colors duration-200",
                "hover:bg-blue-700 active:bg-blue-800",
                "focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-blue-500",
                "focus-visible:ring-offset-2",
                "dark:hover:bg-blue-500",
                "dark:focus-visible:ring-offset-slate-950",
              )}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>

            <button
              type="button"
              onClick={this.handleGoBack}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2",
                "rounded-lg border border-slate-200",
                "bg-white px-5 text-sm font-medium",
                "text-slate-700",
                "transition-colors duration-200",
                "hover:bg-slate-100",
                "focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-blue-500",
                "focus-visible:ring-offset-2",
                "dark:border-slate-700 dark:bg-slate-900",
                "dark:text-slate-200 dark:hover:bg-slate-800",
              )}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go back
            </button>

            <a
              href="/overview"
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2",
                "rounded-lg border border-slate-200",
                "bg-white px-5 text-sm font-medium",
                "text-slate-700",
                "transition-colors duration-200",
                "hover:bg-slate-100",
                "focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-blue-500",
                "focus-visible:ring-offset-2",
                "dark:border-slate-700 dark:bg-slate-900",
                "dark:text-slate-200 dark:hover:bg-slate-800",
              )}
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Overview
            </a>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            If the issue continues, reload the page or contact support.
          </p>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
