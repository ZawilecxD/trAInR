import { cn } from "@/lib/utils";

interface RoundWarmupToggleProps {
  isWarmup: boolean;
  onChange: (isWarmup: boolean) => void;
  disabled?: boolean;
  labelPrefix?: string;
}

export default function RoundWarmupToggle({
  isWarmup,
  onChange,
  disabled = false,
  labelPrefix,
}: RoundWarmupToggleProps) {
  return (
    <div
      className="flex shrink-0 gap-1"
      role="group"
      aria-label={labelPrefix ? `${labelPrefix} round type` : "Round type"}
    >
      {(
        [
          { value: true, label: "Warm-up" },
          { value: false, label: "Working" },
        ] as const
      ).map((option) => (
        <button
          key={option.label}
          type="button"
          disabled={disabled}
          aria-label={labelPrefix ? `${labelPrefix} ${option.label}` : undefined}
          aria-pressed={isWarmup === option.value}
          className={cn(
            "min-w-[4.25rem] shrink-0 rounded-md px-2 py-1 text-[11px] leading-none font-medium whitespace-nowrap transition-colors",
            isWarmup === option.value
              ? option.value
                ? "bg-accent text-muted-foreground"
                : "bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-accent border",
          )}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
