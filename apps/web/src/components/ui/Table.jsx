import { cn } from "../../lib/utils.js";

export function Table({ className, ...props }) {
  return <div className={cn("overflow-x-auto", className)} {...props} />;
}

export function TableHeader({ className, ...props }) {
  return (
    <thead
      className={cn(
        "[&_tr]:border-b [&_tr]:first-child:[&_tr]:border-t",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

export function TableRow({ className, ...props }) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-gray-50 data-[state=selected]:bg-gray-100",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        "h-12 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }) {
  return (
    <td
      className={cn("p-4 align-middle text-sm text-gray-900", className)}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }) {
  return (
    <caption
      className={cn("mt-4 text-sm text-gray-500", className)}
      {...props}
    />
  );
}
