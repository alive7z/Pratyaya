import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils.js";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger
      ref={ref}
      data-slot="select-trigger"
      className={cn(
        "flex h-10 w-full min-w-0 items-center justify-between gap-2",
        "rounded-md border border-slate-300 bg-white px-3 py-2",
        "text-sm text-slate-900 shadow-sm",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "data-placeholder:text-slate-400",
        "hover:border-slate-400",
        "focus:outline-none",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
        "dark:data-placeholder:text-slate-500",
        "dark:hover:border-slate-600",
        "dark:focus:border-blue-400 dark:focus:ring-blue-400/20",
        "[&>span]:line-clamp-1",
        "[&>span]:text-left",
        className,
      )}
      {...props}
    >
      {children}

      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500"
          aria-hidden="true"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  ),
);

SelectTrigger.displayName = "SelectTrigger";

const SelectScrollUpButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      data-slot="select-scroll-up"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        "text-slate-500 dark:text-slate-400",
        className,
      )}
      {...props}
    >
      <ChevronUp className="h-4 w-4" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  ),
);

SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      data-slot="select-scroll-down"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        "text-slate-500 dark:text-slate-400",
        className,
      )}
      {...props}
    >
      <ChevronDown className="h-4 w-4" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  ),
);

SelectScrollDownButton.displayName = "SelectScrollDownButton";

const SelectContent = React.forwardRef(
  (
    { className, children, position = "popper", sideOffset = 4, ...props },
    ref,
  ) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height)",
          "min-w-32 overflow-hidden",
          "rounded-lg border border-slate-200",
          "bg-white text-slate-950 shadow-lg",
          "dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
          "data-[state=open]:animate-in",
          "data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0",
          "data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95",
          "data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2",
          "data-[side=top]:slide-in-from-bottom-2",
          "data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2",
          "motion-reduce:animate-none",
          position === "popper" && "min-w-(--radix-select-trigger-width)",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />

        <SelectPrimitive.Viewport
          data-slot="select-viewport"
          className={cn(
            "p-1",
            position === "popper" &&
              "w-full min-w-(--radix-select-trigger-width)",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>

        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  ),
);

SelectContent.displayName = "SelectContent";

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    data-slot="select-label"
    className={cn(
      "px-2 py-1.5",
      "text-xs font-semibold uppercase tracking-wide",
      "text-slate-500 dark:text-slate-400",
      className,
    )}
    {...props}
  />
));

SelectLabel.displayName = "SelectLabel";

const SelectItem = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center",
        "rounded-md py-2 pl-8 pr-3",
        "text-sm text-slate-700 outline-none",
        "transition-colors duration-150",
        "focus:bg-blue-50 focus:text-blue-900",
        "data-[state=checked]:font-medium",
        "data-[state=checked]:text-blue-700",
        "data-disabled:pointer-events-none",
        "data-disabled:opacity-40",
        "dark:text-slate-200",
        "dark:focus:bg-slate-800 dark:focus:text-slate-50",
        "dark:data-[state=checked]:text-blue-400",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check
            className="h-4 w-4 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  ),
);

SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    data-slot="select-separator"
    className={cn(
      "-mx-1 my-1 h-px",
      "bg-slate-200 dark:bg-slate-800",
      className,
    )}
    {...props}
  />
));

SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
