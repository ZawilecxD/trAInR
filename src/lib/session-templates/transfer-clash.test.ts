import { describe, expect, it } from "vitest";

import { resolveTemplateNameClash } from "@/lib/session-templates/transfer-clash";

describe("resolveTemplateNameClash", () => {
  it("returns create when no templates match", () => {
    expect(resolveTemplateNameClash("Upper A", [{ id: "1", name: "Other" }])).toEqual({
      status: "create",
    });
  });

  it("returns choose with existing_id for a single case-insensitive match", () => {
    expect(
      resolveTemplateNameClash("  upper a  ", [
        { id: "t1", name: "Upper A" },
        { id: "t2", name: "Lower B" },
      ]),
    ).toEqual({
      status: "choose",
      existing_id: "t1",
      existing_name: "Upper A",
    });
  });

  it("returns ambiguous when multiple templates share the name", () => {
    expect(
      resolveTemplateNameClash("Upper A", [
        { id: "t1", name: "Upper A" },
        { id: "t2", name: "upper a" },
      ]),
    ).toEqual({
      status: "ambiguous",
      issues: [
        {
          path: "name",
          message: "ambiguous template name; rename duplicates in the library",
        },
      ],
    });
  });
});
