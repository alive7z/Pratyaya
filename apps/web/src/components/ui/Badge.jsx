import { cn } from "../../lib/utils.js";

const variantStyles = {
  default: "bg-gray-100 text-gray-800",
  secondary: "bg-gray-100 text-gray-800",
  destructive: "bg-red-100 text-red-800",
  success: "bg-green-100 text-green-800",
  outline: "border border-gray-300 bg-transparent text-gray-700",
};

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
