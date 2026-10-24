import { cn } from "../../lib/utils.js";

export function Input({
  className,
  type = "text",
  disabled,
  children,
  ...props
}) {
  if (children) {
    return (
      <div className="relative flex items-center w-full">
        <input
          type={type}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            className,
          )}
          {...props}
        />
        {children}
      </div>
    );
  }

  return (
    <input
      type={type}
      disabled={disabled}
      className={cn(
        "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
        className,
      )}
      {...props}
    />
  );
}
