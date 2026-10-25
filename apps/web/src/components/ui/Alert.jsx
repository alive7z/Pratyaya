import { cn } from "../../lib/utils.js";

const alertVariants = {
  default: [
    "border-blue-200 bg-blue-50 text-blue-900",
    "dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  ],
  destructive: [
    "border-red-200 bg-red-50 text-red-900",
    "dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
  ],
  warning: [
    "border-amber-200 bg-amber-50 text-amber-900",
    "dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  ],
  success: [
    "border-green-200 bg-green-50 text-green-900",
    "dark:border-green-800 dark:bg-green-950/40 dark:text-green-200",
  ],
};

export function Alert({
  className,
  variant = "default",
  role,
  children,
  ...props
}) {
  const resolvedVariant = Object.hasOwn(alertVariants, variant)
    ? variant
    : "default";

  const alertRole =
    role ?? (resolvedVariant === "destructive" ? "alert" : "status");

  return (
    <div
      role={alertRole}
      data-variant={resolvedVariant}
      className={cn(
        "relative w-full rounded-lg border p-4",
        "text-sm leading-relaxed",
        "transition-colors duration-200",
        "[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
        "[&>svg]:h-4 [&>svg]:w-4",
        "[&>svg~*]:pl-7",
        alertVariants[resolvedVariant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertTitle({ className, ...props }) {
  return (
    <h5
      className={cn(
        "mb-1 font-semibold leading-tight tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed",
        "text-current/90",
        "[&_p:not(:last-child)]:mb-2",
        "[&_a]:font-medium [&_a]:underline",
        "[&_a]:underline-offset-4",
        className,
      )}
      {...props}
    />
  );
}
