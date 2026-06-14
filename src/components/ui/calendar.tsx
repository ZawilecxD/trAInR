import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type ClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const defaultClassNames = {
  months: "relative flex w-full flex-col gap-2",
  month: "relative flex w-full flex-col gap-4",
  month_caption: "relative flex h-11 w-full items-center justify-center px-10",
  caption_label: "text-sm font-medium",
  nav: "flex items-center gap-1",
  button_previous: cn(
    buttonVariants({ variant: "outline" }),
    "absolute top-0 left-0 z-10 inline-flex h-11 w-8 items-center justify-center bg-transparent p-0 opacity-70 hover:opacity-100",
  ),
  button_next: cn(
    buttonVariants({ variant: "outline" }),
    "absolute top-0 right-0 z-10 inline-flex h-11 w-8 items-center justify-center bg-transparent p-0 opacity-70 hover:opacity-100",
  ),
  month_grid: "mx-auto w-full max-w-[calc(7*var(--cell-size,2.75rem))] border-collapse",
  weekdays: "mx-auto flex w-full max-w-[calc(7*var(--cell-size,2.75rem))]",
  weekday: "w-11 shrink-0 rounded-md text-[0.8rem] font-normal text-muted-foreground",
  week: "mx-auto mt-2 flex w-full max-w-[calc(7*var(--cell-size,2.75rem))]",
  day: cn(
    "relative w-11 shrink-0 p-0 text-center text-sm focus-within:relative focus-within:z-20",
    "[&:has([aria-selected])]:rounded-md [&:has([aria-selected])]:bg-accent",
  ),
  day_button: cn(buttonVariants({ variant: "ghost" }), "size-11 p-0 font-normal aria-selected:opacity-100"),
  selected:
    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
  today: "bg-accent text-accent-foreground",
  outside: "text-muted-foreground opacity-40",
  disabled: "text-muted-foreground opacity-30",
  hidden: "invisible",
} satisfies Partial<ClassNames>;

function mergeClassNames(overrides?: Partial<ClassNames>): Partial<ClassNames> {
  const keys = new Set([...Object.keys(defaultClassNames), ...Object.keys(overrides ?? {})]);
  return Object.fromEntries(
    [...keys].map((key) => [
      key,
      cn(defaultClassNames[key as keyof typeof defaultClassNames], overrides?.[key as keyof ClassNames]),
    ]),
  );
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout="around"
      className={cn("p-3", className)}
      classNames={mergeClassNames(classNames)}
      components={{
        Chevron: ({ orientation }: { orientation?: "left" | "right" | "up" | "down" }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="size-4" />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
