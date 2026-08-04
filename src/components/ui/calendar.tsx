import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type ClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const defaultClassNames = {
  months: "relative flex w-full min-w-0 flex-col gap-2",
  month: "relative flex w-full min-w-0 flex-col gap-4",
  month_caption: "relative flex h-11 w-full items-center justify-center px-10",
  caption_label: "truncate text-sm font-medium",
  nav: "flex items-center gap-1",
  button_previous: cn(
    buttonVariants({ variant: "outline" }),
    "absolute top-0 left-0 z-10 inline-flex h-11 w-8 items-center justify-center bg-transparent p-0 opacity-70 hover:opacity-100",
  ),
  button_next: cn(
    buttonVariants({ variant: "outline" }),
    "absolute top-0 right-0 z-10 inline-flex h-11 w-8 items-center justify-center bg-transparent p-0 opacity-70 hover:opacity-100",
  ),
  // Fluid 7-column grid: fixed w-11 cells overflow below ~360px content width.
  month_grid: "w-full min-w-0 border-collapse",
  weekdays: "flex w-full min-w-0",
  weekday: "min-w-0 flex-1 basis-0 rounded-md text-center text-[0.8rem] font-normal text-muted-foreground",
  week: "mt-2 flex w-full min-w-0",
  day: cn(
    "relative min-w-0 flex-1 basis-0 p-0 text-center text-sm focus-within:relative focus-within:z-20",
    "[&:has([aria-selected])]:rounded-md [&:has([aria-selected])]:bg-accent",
  ),
  day_button: cn(
    buttonVariants({ variant: "ghost" }),
    "mx-auto aspect-square h-auto w-full max-h-11 max-w-11 p-0 font-normal aria-selected:opacity-100",
  ),
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
