import { Eye, EyeOff } from "lucide-react";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
  /** Test-only selector hook; stripped from production builds (see astro.config.mjs). */
  testId?: string;
}

export function PasswordToggle({ visible, onToggle, testId }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid={testId}
      className="absolute top-1/2 right-3 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
