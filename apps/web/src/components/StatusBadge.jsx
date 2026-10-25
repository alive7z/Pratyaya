import * as React from "react";
import { cn } from "../lib/utils.js";

const statusVariants = {
  ready: {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  degraded: {
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  unreachable: {
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
    dot: "bg-rose-500 dark:bg-rose-400",
  },
  checking: {
    badge:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
    dot: "bg-slate-400 dark:bg-slate-500",
  },
  info: {
    badge:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    dot: "bg-blue-500 dark:bg-blue-400",
  },
};

const StatusBadge = React.forwardRef(
  (
    {
      tone = "checking",
      children,
      showDot = true,
      pulse = false,
      className,
      dotClassName,
      ...props
    },
    ref,
  ) => {
    const resolvedTone = Object.hasOwn(statusVariants, tone)
      ? tone
      : "checking";

    const variant = statusVariants[resolvedTone];

    return (
      <span
        ref={ref}
        data-slot="status-badge"
        data-tone={resolvedTone}
        className={cn(
          "inline-flex w-fit max-w-full shrink-0 items-center gap-1.5",
          "rounded-full border px-2.5 py-1",
          "text-xs font-semibold leading-none",
          "transition-colors duration-200",
          "whitespace-nowrap align-middle",
          variant.badge,
          className,
        )}
        {...props}
      >
        {showDot && (
          <span
            aria-hidden="true"
            className={cn(
              "relative inline-flex h-1.5 w-1.5 shrink-0",
              "items-center justify-center",
            )}
          >
            {pulse && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full",
                  "animate-ping opacity-50",
                  "motion-reduce:animate-none",
                  variant.dot,
                )}
              />
            )}

            <span
              className={cn(
                "relative inline-flex h-1.5 w-1.5 rounded-full",
                variant.dot,
                dotClassName,
              )}
            />
          </span>
        )}

        <span className="min-w-0 truncate">{children}</span>
      </span>
    );
  },
);

StatusBadge.displayName = "StatusBadge";

export default StatusBadge;
