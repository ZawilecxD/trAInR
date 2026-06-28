import { z } from "zod";

const uuidSchema = z.uuid({ error: "Invalid UUID" });

export const sessionIdParamSchema = uuidSchema;

export const commentIdParamSchema = uuidSchema;

export const createCommentBodySchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment cannot exceed 2000 characters"),
});

export type CreateCommentBody = z.infer<typeof createCommentBodySchema>;

export const updateCommentBodySchema = z.object({
  comment_id: uuidSchema,
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment cannot exceed 2000 characters"),
});

export type UpdateCommentBody = z.infer<typeof updateCommentBodySchema>;

export const deleteCommentQuerySchema = z.object({
  comment_id: uuidSchema,
});

export type DeleteCommentQuery = z.infer<typeof deleteCommentQuerySchema>;
