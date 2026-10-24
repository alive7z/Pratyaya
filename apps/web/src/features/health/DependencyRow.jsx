import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import StatusBadge from "../../components/StatusBadge.jsx";

export default function DependencyRow({ name, description, check, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-between gap-4 py-4">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
        </div>
        <LoaderCircle
          aria-hidden="true"
          className="h-4 w-4 animate-spin text-slate-400"
        />
      </div>
    );
  }

  const isUp = check?.status === "up";
  const isDown = check?.status === "down";

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isUp
              ? "bg-emerald-50 text-emerald-600"
              : isDown
                ? "bg-rose-50 text-rose-600"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          {isUp ? (
            <CircleCheck aria-hidden="true" className="h-4 w-4" />
          ) : (
            <CircleAlert aria-hidden="true" className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{name}</p>
          <p className="text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge
          tone={isUp ? "ready" : isDown ? "unreachable" : "checking"}
        >
          {isUp ? "Up" : isDown ? "Down" : "Unknown"}
        </StatusBadge>
        {typeof check?.latencyMs === "number" ? (
          <span className="font-mono text-[11px] text-slate-400">
            {check.latencyMs} ms
          </span>
        ) : null}
      </div>
    </div>
  );
}
