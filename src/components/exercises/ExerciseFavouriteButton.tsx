import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseFavouriteButtonProps {
  exerciseId: string;
  initialIsFavourite: boolean;
  onToggled?: (isFavourite: boolean) => void;
  className?: string;
}

export default function ExerciseFavouriteButton({
  exerciseId,
  initialIsFavourite,
  onToggled,
  className,
}: ExerciseFavouriteButtonProps) {
  const [isFavourite, setIsFavourite] = useState(initialIsFavourite);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    if (pending) return;

    const next = !isFavourite;
    setIsFavourite(next);
    setPending(true);

    try {
      const response = await fetch(`/api/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favourite: next }),
      });

      if (!response.ok) {
        setIsFavourite(!next);
        return;
      }

      onToggled?.(next);
    } catch {
      setIsFavourite(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={isFavourite}
      disabled={pending}
      onClick={() => {
        void handleToggle();
      }}
      className={cn(
        "rounded-md p-1 transition-colors hover:bg-white/10 disabled:opacity-50",
        isFavourite ? "text-amber-300" : "text-blue-100/40 hover:text-amber-200",
        className,
      )}
    >
      <Star className={cn("size-4", isFavourite && "fill-current")} />
    </button>
  );
}
