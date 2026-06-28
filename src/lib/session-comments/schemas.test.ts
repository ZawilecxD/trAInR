import { describe, expect, it } from "vitest";
import {
  createCommentBodySchema,
  deleteCommentQuerySchema,
  sessionIdParamSchema,
  updateCommentBodySchema,
} from "@/lib/session-comments/schemas";

const validSessionId = "a1000001-0000-4000-8000-000000000001";
const validCommentId = "b2000002-0000-4000-8000-000000000002";

describe("sessionIdParamSchema", () => {
  it("accepts a valid UUID", () => {
    const parsed = sessionIdParamSchema.safeParse(validSessionId);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const parsed = sessionIdParamSchema.safeParse("not-a-uuid");
    expect(parsed.success).toBe(false);
  });
});

describe("createCommentBodySchema", () => {
  it("accepts a valid comment body", () => {
    const parsed = createCommentBodySchema.safeParse({ body: "Great session today!" });
    expect(parsed.success).toBe(true);
  });

  it("trims whitespace", () => {
    const parsed = createCommentBodySchema.safeParse({ body: "  hello  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.body).toBe("hello");
    }
  });

  it("rejects empty body", () => {
    const parsed = createCommentBodySchema.safeParse({ body: "   " });
    expect(parsed.success).toBe(false);
  });

  it("rejects body over 2000 characters", () => {
    const parsed = createCommentBodySchema.safeParse({ body: "a".repeat(2001) });
    expect(parsed.success).toBe(false);
  });
});

describe("updateCommentBodySchema", () => {
  it("accepts valid update payload", () => {
    const parsed = updateCommentBodySchema.safeParse({
      comment_id: validCommentId,
      body: "Updated note",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid comment_id", () => {
    const parsed = updateCommentBodySchema.safeParse({
      comment_id: "bad-id",
      body: "Updated note",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("deleteCommentQuerySchema", () => {
  it("accepts valid comment_id", () => {
    const parsed = deleteCommentQuerySchema.safeParse({ comment_id: validCommentId });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid comment_id", () => {
    const parsed = deleteCommentQuerySchema.safeParse({ comment_id: "bad-id" });
    expect(parsed.success).toBe(false);
  });
});
