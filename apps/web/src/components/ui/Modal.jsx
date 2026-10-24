"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

export function Modal({ open, onOpenChange, children }) {
  const contentRef = React.useRef(null);
  const overlayRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  const handleKeyDown = React.useCallback(
    (e) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={contentRef}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        role="document"
      >
        {children}
      </div>
    </div>
  );
}

export function ModalTrigger({ asChild, children, onClick }) {
  if (asChild) {
    return React.cloneElement(children, { onClick });
  }
  return <button onClick={onClick}>{children}</button>;
}

export function ModalContent({ children, className }) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ModalHeader({ children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 pb-4 border-b",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ModalTitle({ children, className }) {
  return <h2 className={cn("text-xl font-bold", className)}>{children}</h2>;
}

export function ModalDescription({ children, className }) {
  return (
    <p className={cn("text-sm text-gray-500 mt-1", className)}>{children}</p>
  );
}

export function ModalFooter({ children, className }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6 pt-4 border-t",
        className,
      )}
    >
      {children}
    </div>
  );
}
