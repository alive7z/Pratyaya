
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils.js";

const ModalContext = React.createContext(null);

export function Modal({
  open,
  onOpenChange,
  children,
  defaultOpen = false,
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const setOpen = React.useCallback(
    (nextOpen) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const contextValue = React.useMemo(
    () => ({ open: isOpen, onOpenChange: setOpen }),
    [isOpen, setOpen],
  );

  return (
    <ModalContext.Provider value={contextValue}>
      <DialogPrimitive.Root
        open={isOpen}
        onOpenChange={setOpen}
      >
        {children}
      </DialogPrimitive.Root>
    </ModalContext.Provider>
  );
}

export function ModalTrigger({
  asChild = false,
  children,
  onClick,
  type = "button",
  ...props
}) {
  const context = React.useContext(ModalContext);

  const handleClick = (event) => {
    onClick?.(event);

    if (!event.defaultPrevented && !context) {
      props.onOpenChange?.(true);
    }
  };

  return (
    <DialogPrimitive.Trigger
      asChild={asChild}
      onClick={handleClick}
      {...(!asChild ? { type } : {})}
      {...props}
    >
      {children}
    </DialogPrimitive.Trigger>
  );
}

const ModalContent = React.forwardRef(
  (
    {
      className,
      children,
      showCloseButton = true,
      overlayClassName,
      ...props
    },
    ref,
  ) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="modal-overlay"
        className={cn(
          "fixed inset-0 z-50",
          "bg-black/60 backdrop-blur-[2px]",
          "data-[state=open]:animate-in",
          "data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0",
          "data-[state=closed]:fade-out-0",
          "motion-reduce:animate-none",
          overlayClassName,
        )}
      />

      <DialogPrimitive.Content
        ref={ref}
        data-slot="modal-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50",
          "flex w-[calc(100%-2rem)] max-w-2xl flex-col",
          "max-h-[calc(100dvh-2rem)]",
          "-translate-x-1/2 -translate-y-1/2",
          "overflow-y-auto overscroll-contain",
          "rounded-xl border border-slate-200",
          "bg-white text-slate-950 shadow-2xl",
          "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50",
          "duration-200 ease-out",
          "data-[state=open]:animate-in",
          "data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0",
          "data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95",
          "data-[state=closed]:zoom-out-95",
          "focus:outline-none",
          "motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            type="button"
            aria-label="Close modal"
            className={cn(
              "absolute right-4 top-4 z-10",
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
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);

ModalContent.displayName = "ModalContent";

export function ModalHeader({ className, ...props }) {
  return (
    <div
      data-slot="modal-header"
      className={cn(
        "flex flex-col gap-1.5",
        "border-b border-slate-200",
        "px-5 py-5 pr-14 sm:px-6 sm:pr-14",
        "dark:border-slate-800",
        className,
      )}
      {...props}
    />
  );
}

const ModalTitle = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      data-slot="modal-title"
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

ModalTitle.displayName = "ModalTitle";

const ModalDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      data-slot="modal-description"
      className={cn(
        "text-sm leading-relaxed",
        "text-slate-500 dark:text-slate-400",
        className,
      )}
      {...props}
    />
  ),
);

ModalDescription.displayName = "ModalDescription";

export function ModalFooter({ className, ...props }) {
  return (
    <div
      data-slot="modal-footer"
      className={cn(
        "flex flex-col-reverse gap-2",
        "border-t border-slate-200",
        "px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6",
        "dark:border-slate-800",
        className,
      )}
      {...props}
    />
  );
}

export const ModalClose = DialogPrimitive.Close;
