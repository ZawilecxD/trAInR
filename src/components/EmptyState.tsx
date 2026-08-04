import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { surfaceCardClass } from "@/lib/ui-classes";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Shared empty-list / empty-page placeholder — DESIGN.md Empty State */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(surfaceCardClass, "px-6 py-10 text-center", className)}>
      <p className="text-foreground text-lg font-medium">{title}</p>
      {description ? <p className="text-muted-foreground mt-2 text-sm">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
