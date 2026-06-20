import { cn } from "@/lib/utils";

interface RoundWarmupToggleProps {
  isWarmup: boolean;
  onChange: (isWarmup: boolean) => void;
  disabled?: boolean;
}

export default function RoundWarmupToggle({ isWarmup, onChange, disabled = false }: RoundWarmupToggleProps) {
  return (
    <div className="flex shrink-0 gap-1" role="group" aria-label="Round type">
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
          aria-pressed={isWarmup === option.value}
          className={cn(
            "min-w-[4.25rem] shrink-0 rounded-md px-2 py-1 text-[11px] leading-none font-medium whitespace-nowrap transition-colors",
            isWarmup === option.value
              ? option.value
                ? "bg-white/15 text-blue-100/70"
                : "bg-purple-500 text-white"
              : "border border-white/20 text-blue-100/80 hover:bg-white/10",
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
