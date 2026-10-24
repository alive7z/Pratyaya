"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils.js";

const ToastContext = createContext(null);

const variantIcons = {
  success: CheckCircle,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

const variantClasses = {
  success:
    "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/80 dark:border-green-800 dark:text-green-200",
  error:
    "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/80 dark:border-red-800 dark:text-red-200",
  warning:
    "bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950/80 dark:border-yellow-800 dark:text-yellow-200",
  info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/80 dark:border-blue-800 dark:text-blue-200",
};

function toastVariant(variant) {
  return variantClasses[variant] ?? variantClasses.info;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    ({ title, description, variant = "info", duration = 5000 }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [
        ...prev,
        { id, title, description, variant, duration },
      ]);
      return id;
    },
    [],
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-dismiss toasts
  useEffect(() => {
    const timers = toasts.map((t) => {
      if (t.duration <= 0) return null;
      return setTimeout(() => dismissToast(t.id), t.duration);
    });
    return () => timers.forEach((t) => t && clearTimeout(t));
  }, [toasts, dismissToast]);

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, dismissToast }}
    >
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const Icon = variantIcons[toast.variant] ?? Info;
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border p-4 shadow-lg ring-1 ring-black/5 fade-in",
                toastVariant(toast.variant),
              )}
            >
              <div className="flex shrink-0 items-center">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-sm leading-none">
                {toast.title ? (
                  <p className="font-medium leading-none">{toast.title}</p>
                ) : null}
                {toast.description ? (
                  <p className="mt-1 text-sm opacity-90">{toast.description}</p>
                ) : null}
              </div>
              <div className="ml-auto flex shrink-0 items-center">
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-sm opacity-50 hover:opacity-100 transition focus:outline-none focus:ring-2"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return { addToast: () => {}, removeToast: () => {}, toasts: [] };
  }
  return context;
}
