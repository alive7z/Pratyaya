"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "../../lib/utils.js";

const ToastContext = createContext(null);

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 5000;

const variantConfig = {
  success: {
    icon: CheckCircle2,
    classes:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-200",
    iconClasses: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: AlertCircle,
    classes:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/95 dark:text-red-200",
    iconClasses: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/95 dark:text-amber-200",
    iconClasses: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    classes:
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/95 dark:text-blue-200",
    iconClasses: "text-blue-600 dark:text-blue-400",
  },
};

function ToastItem({ toast, onDismiss }) {
  const {
    id,
    title,
    description,
    variant = "info",
    duration = DEFAULT_DURATION,
  } = toast;

  const config = variantConfig[variant] ?? variantConfig.info;
  const Icon = config.icon;
  const timerRef = useRef(null);
  const remainingRef = useRef(duration);
  const startedAtRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pauseTimer = useCallback(() => {
    if (startedAtRef.current !== null) {
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current),
      );
      startedAtRef.current = null;
    }

    clearTimer();
  }, [clearTimer]);

  const resumeTimer = useCallback(() => {
    if (duration <= 0 || timerRef.current !== null) {
      return;
    }

    startedAtRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      startedAtRef.current = null;
      onDismiss(id);
    }, remainingRef.current);
  }, [duration, id, onDismiss]);

  useEffect(() => {
    remainingRef.current = duration;
    startedAtRef.current = null;
    clearTimer();

    if (duration > 0) {
      resumeTimer();
    }

    return clearTimer;
  }, [duration, resumeTimer, clearTimer]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseTimer();
      } else {
        resumeTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pauseTimer, resumeTimer]);

  return (
    <div
      data-slot="toast"
      data-variant={variant}
      role={variant === "error" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onFocusCapture={pauseTimer}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          resumeTimer();
        }
      }}
      className={cn(
        "pointer-events-auto relative flex w-full items-start gap-3",
        "rounded-xl border p-4 pr-11 shadow-lg",
        "ring-1 ring-black/5",
        "transition-[transform,opacity] duration-200",
        "animate-in fade-in-0 slide-in-from-top-2",
        "dark:ring-white/5",
        "motion-reduce:animate-none",
        config.classes,
      )}
    >
      <Icon
        className={cn("mt-0.5 h-5 w-5 shrink-0", config.iconClasses)}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1 space-y-1">
        {title && (
          <p className="wrap-break-word text-sm font-semibold leading-5">
            {title}
          </p>
        )}

        {description && (
          <p className="wrap-break-word text-sm leading-relaxed opacity-90">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className={cn(
          "absolute right-3 top-3",
          "inline-flex h-7 w-7 items-center justify-center",
          "rounded-md opacity-60",
          "transition-[background-color,opacity] duration-150",
          "hover:bg-black/5 hover:opacity-100",
          "dark:hover:bg-white/10",
          "focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-current",
          "focus-visible:ring-offset-2",
          "focus-visible:ring-offset-transparent",
        )}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({
  children,
  maxToasts = MAX_TOASTS,
  position = "top-right",
}) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    ({
      title,
      description,
      variant = "info",
      duration = DEFAULT_DURATION,
    } = {}) => {
      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const toast = {
        id,
        title,
        description,
        variant: variantConfig[variant] ? variant : "info",
        duration:
          typeof duration === "number" && Number.isFinite(duration)
            ? Math.max(0, duration)
            : DEFAULT_DURATION,
      };

      setToasts((previous) => {
        const limit = Number.isFinite(maxToasts)
          ? Math.max(1, Math.floor(maxToasts))
          : MAX_TOASTS;

        return [...previous, toast].slice(-limit);
      });

      return id;
    },
    [maxToasts],
  );

  const removeToast = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const dismissToast = removeToast;

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
      dismissToast,
      dismissAll,
    }),
    [toasts, addToast, removeToast, dismissToast, dismissAll],
  );

  const positionClasses = {
    "top-right": "top-4 right-4 sm:top-5 sm:right-5",
    "top-left": "top-4 left-4 sm:top-5 sm:left-5",
    "bottom-right": "bottom-4 right-4 sm:bottom-5 sm:right-5",
    "bottom-left": "bottom-4 left-4 sm:bottom-5 sm:left-5",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        data-slot="toast-viewport"
        className={cn(
          "pointer-events-none fixed z-100",
          "flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3",
          "max-h-[calc(100dvh-2rem)] overflow-y-auto",
          "overscroll-contain",
          positionClasses[position] ?? positionClasses["top-right"],
        )}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const noop = () => {};

const fallbackContext = {
  toasts: [],
  addToast: noop,
  removeToast: noop,
  dismissToast: noop,
  dismissAll: noop,
};

export function useToast() {
  return useContext(ToastContext) ?? fallbackContext;
}
