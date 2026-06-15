"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  empty: string;
  getRowKey: (row: T) => string;
};

export function DataTable<T>({ columns, data, empty, getRowKey }: DataTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labeledColumns = columns.filter((c) => c.header?.trim());
  const unlabeledColumns = columns.filter((c) => !c.header?.trim());

  useEffect(() => {
    const rows = containerRef.current?.querySelectorAll("tbody tr");
    if (rows && rows.length > 0) {
      gsap.fromTo(
        rows,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, stagger: 0.04, ease: "power2.out", delay: 0.15 }
      );
    }
  }, []);

  return (
    <div ref={containerRef} className="overflow-hidden rounded-lg border border-ink-100 dark:border-ink-800">
      {data.length === 0 ? (
        <div className="px-4 py-16 text-center text-body-sm text-ink-400 dark:text-ink-500">{empty}</div>
      ) : (
        <>
          {/* Desktop / tablet: classic table */}
          <div className="hidden md:block md:overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-ink-100 dark:border-ink-800">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        "px-4 py-3.5 text-start text-caption-uppercase uppercase tracking-wider text-ink-500 dark:text-ink-400",
                        column.className,
                      )}
                    >
                      {column.header || "\u00a0"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50 bg-white dark:divide-ink-800/50 dark:bg-ink-900">
                {data.map((row, idx) => (
                  <tr
                    key={getRowKey(row)}
                    className={cn(
                      "transition-colors duration-100",
                      "hover:bg-ink-50/80 dark:hover:bg-ink-800/40",
                      idx % 2 === 0 ? "bg-white dark:bg-ink-900" : "bg-ink-50/30 dark:bg-ink-900/50",
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn("px-4 py-3.5 align-middle text-start text-body-sm", column.className)}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden">
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {data.map((row) => (
                <li
                  key={getRowKey(row)}
                  className="bg-white px-4 py-4 dark:bg-ink-900"
                >
                  <dl className="space-y-3">
                    {labeledColumns.map((col) => (
                      <div key={col.key} className="min-w-0">
                        <dt className="text-caption-uppercase uppercase tracking-wider text-ink-500 dark:text-ink-400">
                          {col.header}
                        </dt>
                        <dd
                          className={cn(
                            "mt-0.5 text-body-sm leading-snug text-ink-800 dark:text-ink-100 break-words",
                            col.className,
                          )}
                        >
                          {col.cell(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {unlabeledColumns.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
                      {unlabeledColumns.map((col) => (
                        <div key={col.key} className="min-w-0 [&_a]:inline-flex [&_button]:w-full">
                          {col.cell(row)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
