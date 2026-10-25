import { cn } from "../../lib/utils.js";

const badgeVariants = {
  default: [
    "border-transparent bg-blue-100 text-blue-800",
    "dark:bg-blue-950/60 dark:text-blue-300",
  ],

  secondary: [
    "border-transparent bg-slate-100 text-slate-700",
    "dark:bg-slate-800 dark:text-slate-200",
  ],

  destructive: [
    "border-transparent bg-red-100 text-red-800",
    "dark:bg-red-950/60 dark:text-red-300",
  ],

  success: [
    "border-transparent bg-emerald-100 text-emerald-800",
    "dark:bg-emerald-950/60 dark:text-emerald-300",
  ],

  warning: [
    "border-transparent bg-amber-100 text-amber-800",
    "dark:bg-amber-950/60 dark:text-amber-300",
  ],

  info: [
    "border-transparent bg-sky-100 text-sky-800",
    "dark:bg-sky-950/60 dark:text-sky-300",
  ],

  outline: [
    "border-slate-300 bg-transparent text-slate-700",
    "dark:border-slate-600 dark:text-slate-300",
  ],
};

export function Badge({ className, variant = "default", children, ...props }) {
  const resolvedVariant = Object.hasOwn(badgeVariants, variant)
    ? variant
    : "default";

  return (
    <span
      data-variant={resolvedVariant}
      className={cn(
        // Base styles
        "inline-flex shrink-0 items-center justify-center gap-1",
        "rounded-full border px-2.5 py-0.5",
        "text-xs font-semibold leading-5",
        "whitespace-nowrap align-middle",

        // Transitions
        "transition-colors duration-200",

        // Optional icon support
        "[&>svg]:h-3 [&>svg]:w-3",
        "[&>svg]:shrink-0",

        // Variant
        badgeVariants[resolvedVariant],

        // Custom styles
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
