import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import StatusBadge from "../../components/StatusBadge.jsx";

export default function DependencyRow({
  name,
  description,
  check,
  isLoading = false,
}) {
  const status = check?.status?.toLowerCase();
  const isUp = status === "up";
  const isDown = status === "down";

  const tone = isUp ? "ready" : isDown ? "unreachable" : "checking";

  const label = isUp ? "Up" : isDown ? "Down" : "Unknown";

  return (
    <div className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-100 py-4 last:border-0 dark:border-slate-800">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isLoading
              ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
              : isUp
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                : isDown
                  ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {isLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : isUp ? (
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {name}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center gap-1">
        {isLoading ? (
          <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        ) : (
          <>
            <StatusBadge tone={tone}>{label}</StatusBadge>

            {Number.isFinite(check?.latencyMs) && (
              <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {Math.round(check.latencyMs)} ms
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
