import ExerciseNavList from "@/components/guided-workout/ExerciseNavList";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { SessionExerciseDetail } from "@/lib/workout-sessions/service";

interface ExerciseNavMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: SessionExerciseDetail[];
  exerciseIndex: number;
  onSelectExercise: (index: number) => void;
}

export default function ExerciseNavMenu({
  open,
  onOpenChange,
  exercises,
  exerciseIndex,
  onSelectExercise,
}: ExerciseNavMenuProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="border-border bg-background text-foreground [&>button.absolute]:hidden">
        <div className="border-border flex items-center justify-end border-b pb-3">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground min-h-11 px-2 text-sm"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Close
          </button>
        </div>

        <ExerciseNavList
          exercises={exercises}
          exerciseIndex={exerciseIndex}
          onSelectExercise={(index) => {
            onSelectExercise(index);
            onOpenChange(false);
          }}
          className="max-h-[70vh]"
        />
      </SheetContent>
    </Sheet>
  );
}
