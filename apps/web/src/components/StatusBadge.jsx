const toneClasses = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-800",
  unreachable: "border-rose-200 bg-rose-50 text-rose-700",
  checking: "border-slate-200 bg-slate-50 text-slate-600",
  info: "border-blue-200 bg-blue-50 text-blue-700",
};

const dotClasses = {
  ready: "bg-emerald-500",
  degraded: "bg-amber-500",
  unreachable: "bg-rose-500",
  checking: "bg-slate-400",
  info: "bg-blue-500",
};

export default function StatusBadge({
  tone = "checking",
  children,
  showDot = true,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone] ?? toneClasses.checking}`}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone] ?? dotClasses.checking}`}
        />
      ) : null}
      {children}
    </span>
  );
}
