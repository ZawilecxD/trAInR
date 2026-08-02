import { cn } from "@/lib/utils";

/** Shared form field styling aligned with DESIGN.md Input primitive */
export const formInputClass =
  "w-full rounded-[var(--radius)] border border-input bg-popover px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Raised card surface — DESIGN.md Card primitive */
export const surfaceCardClass = "rounded-[var(--radius-lg)] border border-border bg-card";

/** Auth / modal card shell */
export const authCardClass = cn(surfaceCardClass, "p-8 text-card-foreground");

/** Page content shell with gym-safety side padding */
export const pageShellClass = "bg-background min-h-screen p-5 md:p-8";

/** Inline / page error banner — destructive surface recipe */
export const errorBannerClass =
  "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive";

/** Compact form-level error row (icon + message) */
export const errorBannerCompactClass =
  "flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive";

/** Success / flash banner */
export const successBannerClass = "rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success";

export function formInputClassWithError(hasError: boolean): string {
  return cn(formInputClass, hasError && "border-destructive/60 focus-visible:ring-destructive/40");
}
