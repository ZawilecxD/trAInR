import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "label-caps inline-flex w-fit shrink-0 items-center rounded-[var(--radius-pill)] border px-2.5 py-1",
  {
    variants: {
      status: {
        success: "border-success/30 bg-success/15 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning",
        muted: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "muted",
    },
  },
);

export type StatusBadgeStatus = NonNullable<VariantProps<typeof statusBadgeVariants>["status"]>;

export interface StatusBadgeProps
  extends Omit<ComponentProps<"span">, "children">, VariantProps<typeof statusBadgeVariants> {
  children: ReactNode;
}

/** Pill status chip — DESIGN.md Badge / Status (completed / in-progress / not-started) */
export function StatusBadge({ status = "muted", className, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ status }), className)} data-slot="status-badge" {...props}>
      {children}
    </span>
  );
}

export { statusBadgeVariants };
