
import * as React from "react";
import { cn } from "../../lib/utils.js";

const Skeleton = React.forwardRef(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "block h-4 w-full rounded-md",
        "bg-slate-200 dark:bg-slate-800",
        "animate-pulse",
        "motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  ),
);

Skeleton.displayName = "Skeleton";

const SkeletonCircle = React.forwardRef(
  ({ className, size = 32, style, ...props }, ref) => (
    <Skeleton
      ref={ref}
      data-slot="skeleton-circle"
      className={cn(
        "inline-block h-8 w-8 shrink-0 rounded-full",
        className,
      )}
      style={{
        width: size,
        height: size,
        ...style,
      }}
      {...props}
    />
  ),
);

SkeletonCircle.displayName = "SkeletonCircle";

export function SkeletonText({
  className,
  lines = 3,
  lineClassName,
  lastLineWidth = "66.666667%",
  ...props
}) {
  const count = Math.max(0, Math.min(100, Math.floor(Number(lines) || 0)));

  return (
    <div
      data-slot="skeleton-text"
      aria-hidden="true"
      className={cn(
        "flex w-full flex-col gap-3",
        className,
      )}
      {...props}
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", lineClassName)}
          style={
            index === count - 1
              ? { width: lastLineWidth }
              : undefined
          }
        />
      ))}
    </div>
  );
}

export function SkeletonTableRow({
  className,
  columns = 6,
  cellClassName,
  ...props
}) {
  const count = Math.max(
    0,
    Math.min(100, Math.floor(Number(columns) || 0)),
  );

  return (
    <tr
      data-slot="skeleton-table-row"
      aria-hidden="true"
      className={cn(
        "border-b border-slate-200",
        "dark:border-slate-800",
        className,
      )}
      {...props}
    >
      {Array.from({ length: count }, (_, index) => (
        <td
          key={index}
          className={cn("px-4 py-4", cellClassName)}
        >
          <Skeleton
            className={cn(
              "h-4",
              index === 0 ? "w-3/4" : "w-full",
            )}
          />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard({ className, ...props }) {
  return (
    <div
      data-slot="skeleton-card"
      aria-hidden="true"
      className={cn(
        "flex flex-col gap-5 rounded-xl border p-5",
        "border-slate-200 bg-white",
        "dark:border-slate-800 dark:bg-slate-950",
        "sm:p-6",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        <SkeletonCircle size={40} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>

      <SkeletonText lines={3} />

      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonAvatar({
  className,
  size = 40,
  ...props
}) {
  return (
    <SkeletonCircle
      data-slot="skeleton-avatar"
      size={size}
      className={className}
      {...props}
    />
  );
}

export {
  Skeleton,
  SkeletonCircle,
};
