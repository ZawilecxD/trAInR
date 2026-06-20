import { cn } from "@/lib/utils";

interface RoundWarmupToggleProps {
  isWarmup: boolean;
  onChange: (isWarmup: boolean) => void;
  disabled?: boolean;
}

export default function RoundWarmupToggle({ isWarmup, onChange, disabled = false }: RoundWarmupToggleProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="Round type">
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
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
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
