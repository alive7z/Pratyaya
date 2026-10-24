
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils.js";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]",
        "transition-colors duration-200",
        "data-[state=open]:animate-in",
        "data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0",
        "data-[state=closed]:fade-out-0",
        "motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  ),
);

DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef(
  (
    {
      className,
      children,
      showCloseButton = true,
      overlayClassName,
      onOpenAutoFocus,
      ...props
    },
    ref,
  ) => (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />

      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          "fixed left-1/2 top-1/2 z-50",
          "grid w-[calc(100%-2rem)] max-w-lg",
          "max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "-translate-x-1/2 -translate-y-1/2",
          "gap-5 rounded-xl border p-5 shadow-2xl sm:p-6",
          "border-slate-200 bg-white text-slate-950",
          "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50",
          "duration-200 ease-out",
          "data-[state=open]:animate-in",
          "data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0",
          "data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95",
          "data-[state=closed]:zoom-out-95",
          "data-[state=open]:slide-in-from-left-1/2",
          "data-[state=open]:slide-in-from-top-[48%]",
          "data-[state=closed]:slide-out-to-left-1/2",
          "data-[state=closed]:slide-out-to-top-[48%]",
          "focus:outline-none",
          "motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4",
              "inline-flex h-8 w-8 items-center justify-center",
              "rounded-md text-slate-500",
              "transition-colors duration-200",
              "hover:bg-slate-100 hover:text-slate-900",
              "dark:text-slate-400",
              "dark:hover:bg-slate-800 dark:hover:text-slate-100",
              "focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-blue-500",
              "focus-visible:ring-offset-2",
              "dark:focus-visible:ring-blue-400",
              "dark:focus-visible:ring-offset-slate-950",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);

DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }) => (
  <div
    data-slot="dialog-header"
    className={cn(
      "flex flex-col gap-2",
      "text-center sm:text-left",
      className,
    )}
    {...props}
  />
);

DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      "flex flex-col-reverse gap-2",
      "sm:flex-row sm:items-center sm:justify-end",
      className,
    )}
    {...props}
  />
);

DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      data-slot="dialog-title"
      className={cn(
        "text-lg font-semibold leading-tight tracking-tight",
        "text-slate-950 dark:text-slate-50",
        "sm:text-xl",
        className,
      )}
      {...props}
    />
  ),
);

DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      data-slot="dialog-description"
      className={cn(
        "text-sm leading-relaxed",
        "text-slate-500 dark:text-slate-400",
        className,
      )}
      {...props}
    />
  ),
);

DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
