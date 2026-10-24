
import * as React from "react";
import { cn } from "../../lib/utils.js";

const Input = React.forwardRef(
  (
    {
      className,
      type = "text",
      disabled = false,
      children,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const hasAdornment = React.Children.count(children) > 0;
    const isInvalid = ariaInvalid === true || ariaInvalid === "true";

    const input = (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        data-slot="input"
        className={cn(
          "flex h-10 w-full min-w-0 rounded-md border",
          "border-slate-300 bg-white px-3 py-2",
          "text-sm text-slate-900",
          "shadow-sm transition-[border-color,box-shadow,background-color] duration-200",
          "placeholder:text-slate-400",
          "file:mr-3 file:border-0 file:bg-transparent",
          "file:text-sm file:font-medium file:text-slate-700",
          "focus-visible:outline-none",
          "focus-visible:border-blue-500",
          "focus-visible:ring-2 focus-visible:ring-blue-500/20",
          "hover:border-slate-400",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "disabled:bg-slate-50",
          "read-only:bg-slate-50",
          "dark:border-slate-700 dark:bg-slate-900",
          "dark:text-slate-100 dark:placeholder:text-slate-500",
          "dark:file:text-slate-200",
          "dark:hover:border-slate-600",
          "dark:focus-visible:border-blue-400",
          "dark:focus-visible:ring-blue-400/20",
          "dark:disabled:bg-slate-900/50",
          "dark:read-only:bg-slate-900/50",
          isInvalid &&
            "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20 dark:border-red-500 dark:focus-visible:border-red-400 dark:focus-visible:ring-red-400/20",
          hasAdornment && "pr-10",
          className,
        )}
        {...props}
      />
    );

    if (!hasAdornment) {
      return input;
    }

    return (
      <div
        data-slot="input-wrapper"
        className="relative flex w-full min-w-0 items-center"
      >
        {input}

        <div
          data-slot="input-adornment"
          className={cn(
            "absolute inset-y-0 right-3",
            "flex items-center justify-center gap-1.5",
            "text-slate-500 dark:text-slate-400",
            "[&>svg]:h-4 [&>svg]:w-4",
            "[&>svg]:shrink-0",
          )}
        >
          {children}
        </div>
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
