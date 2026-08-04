import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  pending: boolean;
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
  /** Test-only selector hook; stripped from production builds (see astro.config.mjs). */
  testId?: string;
}

export function SubmitButton({ pending, pendingText, icon, children, testId }: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={pending}
      data-testid={testId}
      className="min-h-11 w-full text-[15px] font-semibold"
      size="lg"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="border-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}
