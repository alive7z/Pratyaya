
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/utils.js";

const Switch = React.forwardRef(
  (
    {
      className,
      checked,
      defaultChecked,
      onCheckedChange,
      disabled = false,
      required = false,
      ...props
    },
    ref,
  ) => (
    <SwitchPrimitive.Root
      ref={ref}
      data-slot="switch"
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      required={required}
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0",
        "cursor-pointer items-center rounded-full border-2 border-transparent",
        "shadow-sm transition-colors duration-200 ease-in-out",
        "select-none touch-pan-y",
        "bg-slate-200 data-[state=checked]:bg-blue-600",
        "hover:data-[state=checked]:bg-blue-700",
        "dark:bg-slate-700",
        "dark:data-[state=checked]:bg-blue-600",
        "dark:hover:data-[state=checked]:bg-blue-500",
        "focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-blue-500",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-white",
        "dark:focus-visible:ring-blue-400",
        "dark:focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full",
          "bg-white shadow-md ring-0",
          "transition-transform duration-200 ease-in-out",
          "data-[state=checked]:translate-x-5",
          "data-[state=unchecked]:translate-x-0",
          "motion-reduce:transition-none",
        )}
      />
    </SwitchPrimitive.Root>
  ),
);

Switch.displayName = "Switch";

export { Switch };
