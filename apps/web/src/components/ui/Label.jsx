import * as React from "react";
import { cn } from "../../lib/utils.js";

const Label = React.forwardRef(
  (
    { className, required = false, disabled = false, children, ...props },
    ref,
  ) => (
    <label
      ref={ref}
      data-slot="label"
      data-disabled={disabled || undefined}
      className={cn(
        "inline-flex items-center gap-1.5",
        "text-sm font-medium leading-none",
        "text-slate-700 dark:text-slate-200",
        "select-none",
        "transition-colors duration-200",
        "peer-disabled:cursor-not-allowed",
        "peer-disabled:opacity-50",
        "data-[disabled=true]:cursor-not-allowed",
        "data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    >
      {children}

      {required && (
        <span aria-hidden="true" className="text-red-500 dark:text-red-400">
          *
        </span>
      )}
    </label>
  ),
);

Label.displayName = "Label";

export { Label };
