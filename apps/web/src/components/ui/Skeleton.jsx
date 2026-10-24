import { cn } from "../../lib/utils.js";

export function Skeleton({ className, ...props }) {
  return (
    <span
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-800",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonCircle({ className, ...props }) {
  return (
    <span
      className={cn(
        "animate-pulse inline-block h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-800",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonText({ className, lines = 3, ...props }) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {[...Array(lines)].map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

export function SkeletonTableRow({ className, ...props }) {
  return (
    <tr className={cn("border-b", className)} {...props}>
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </tr>
  );
}
