import { describe, expect, it } from "vitest";
import { monthRange, visibleMonthRange } from "@/lib/dates";

describe("visibleMonthRange", () => {
  it("includes trailing days of the previous month and leading days of the next", () => {
    // June 2026 starts on Monday and ends on Tuesday; the grid spans Sun May 31 to Sat Jul 4.
    expect(visibleMonthRange(2026, 5)).toEqual({ from: "2026-05-31", to: "2026-07-04" });
  });

  it("does not over-expand when the month starts Sunday and ends Saturday", () => {
    // August 2026 starts on Saturday and ends on Monday — grid is Sun Jul 26 to Sat Sep 5.
    const range = visibleMonthRange(2026, 7);
    expect(range.from).toBe("2026-07-26");
    expect(range.to).toBe("2026-09-05");
  });

  it("produces correct local ISO dates when the month crosses a year boundary", () => {
    // January 2027 starts on Friday; the grid begins on the prior Sunday in December 2026.
    const range = visibleMonthRange(2027, 0);
    expect(range.from).toBe("2026-12-27");
    expect(range.to).toBe("2027-02-06");
  });

  it("always spans at least the full calendar month", () => {
    const exact = monthRange(2026, 5);
    const visible = visibleMonthRange(2026, 5);
    expect(visible.from <= exact.from).toBe(true);
    expect(visible.to >= exact.to).toBe(true);
  });
});
