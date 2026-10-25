import { cn } from "../../lib/utils.js";

export function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-xl border",
        "border-slate-200 bg-white text-slate-950",
        "shadow-sm",
        "transition-[background-color,border-color,box-shadow] duration-200",
        "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5", "p-5 sm:p-6", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "text-lg font-semibold leading-tight tracking-tight",
        "text-slate-950 dark:text-slate-50",
        "sm:text-xl",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return (
    <p
      data-slot="card-description"
      className={cn(
        "text-sm leading-relaxed",
        "text-slate-500 dark:text-slate-400",
        className,
      )}
      {...props}
    />
  );
}

export function CardAction({ className, ...props }) {
  return (
    <div
      data-slot="card-action"
      className={cn("flex items-center gap-2", "self-start", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return (
    <div
      data-slot="card-content"
      className={cn("min-w-0 flex-1 p-5 pt-0 sm:p-6 sm:pt-0", className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-3",
        "p-5 pt-0 sm:p-6 sm:pt-0",
        className,
      )}
      {...props}
    />
  );
}
