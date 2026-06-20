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
      <SheetContent side="bottom" className="border-white/10 bg-slate-950 text-white [&>button.absolute]:hidden">
        <div className="flex items-center justify-end border-b border-white/10 pb-3">
          <button
            type="button"
            className="min-h-11 px-2 text-sm text-blue-100/70 hover:text-white"
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
