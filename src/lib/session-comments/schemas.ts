import { z } from "zod";

export const createSessionCommentBodySchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(2000, "Comment cannot exceed 2000 characters"),
});

export type CreateSessionCommentBody = z.infer<typeof createSessionCommentBodySchema>;
