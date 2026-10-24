
import { cn } from "../../lib/utils.js";

const buttonVariants = {
  default:
    "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-700",

  destructive:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500",

  outline:
    "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800",

  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",

  ghost:
    "text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800",

  link:
    "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400",
};

const buttonSizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3 text-xs",
  lg: "h-11 rounded-lg px-8 text-base",
  icon: "h-10 w-10 shrink-0",
  "icon-sm": "h-8 w-8 shrink-0",
  "icon-lg": "h-12 w-12 shrink-0",
};

export function Button({
  className,
  variant = "default",
  size = "default",
  disabled = false,
  loading = false,
  type = "button",
  children,
  ...props
}) {
  const resolvedVariant = Object.hasOwn(buttonVariants, variant)
    ? variant
    : "default";

  const resolvedSize = Object.hasOwn(buttonSizes, size)
    ? size
    : "default";

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2",
        "rounded-md text-sm font-medium whitespace-nowrap",
        "transition-colors duration-200 ease-in-out",
        "select-none",
        "focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-blue-500",
        "focus-visible:ring-offset-2",
        "dark:focus-visible:ring-blue-400",
        "dark:focus-visible:ring-offset-slate-950",
        "disabled:pointer-events-none disabled:cursor-not-allowed",
        "disabled:opacity-50",
        "[&>svg]:pointer-events-none",
        "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
        buttonVariants[resolvedVariant],
        buttonSizes[resolvedSize],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
