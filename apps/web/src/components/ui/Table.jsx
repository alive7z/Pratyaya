
import * as React from "react";
import { cn } from "../../lib/utils.js";

const Table = React.forwardRef(
  ({ className, containerClassName, ...props }, ref) => (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto",
        "overscroll-x-contain",
        "rounded-lg border border-slate-200",
        "dark:border-slate-800",
        containerClassName,
      )}
    >
      <table
        ref={ref}
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-collapse",
          "text-left text-sm",
          "text-slate-900 dark:text-slate-100",
          className,
        )}
        {...props}
      />
    </div>
  ),
);

Table.displayName = "Table";

const TableHeader = React.forwardRef(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      data-slot="table-header"
      className={cn(
        "bg-slate-50 dark:bg-slate-900/70",
        "[&_tr]:border-b",
        "dark:[&_tr]:border-slate-800",
        className,
      )}
      {...props}
    />
  ),
);

TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      data-slot="table-body"
      className={cn(
        "bg-white dark:bg-slate-950",
        "[&_tr:last-child]:border-0",
        className,
      )}
      {...props}
    />
  ),
);

TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      data-slot="table-footer"
      className={cn(
        "border-t border-slate-200",
        "bg-slate-50 font-medium",
        "dark:border-slate-800 dark:bg-slate-900/70",
        "[&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  ),
);

TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      data-slot="table-row"
      className={cn(
        "border-b border-slate-200",
        "transition-colors duration-150",
        "hover:bg-slate-50",
        "data-[state=selected]:bg-blue-50",
        "dark:border-slate-800",
        "dark:hover:bg-slate-900/70",
        "dark:data-[state=selected]:bg-blue-950/30",
        className,
      )}
      {...props}
    />
  ),
);

TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      data-slot="table-head"
      scope="col"
      className={cn(
        "h-11 whitespace-nowrap px-4",
        "text-left align-middle",
        "text-xs font-semibold uppercase tracking-wider",
        "text-slate-500 dark:text-slate-400",
        "has-[[role=checkbox]]:pr-0",
        "*:[[role=checkbox]]:translate-y-0.5",
        className,
      )}
      {...props}
    />
  ),
);

TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle",
        "text-sm text-slate-700",
        "dark:text-slate-200",
        "has-[[role=checkbox]]:pr-0",
        "*:[[role=checkbox]]:translate-y-0.5",
        className,
      )}
      {...props}
    />
  ),
);

TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      data-slot="table-caption"
      className={cn(
        "caption-bottom px-4 py-3",
        "text-sm text-slate-500",
        "dark:text-slate-400",
        className,
      )}
      {...props}
    />
  ),
);

TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};
