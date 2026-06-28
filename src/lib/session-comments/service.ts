import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionComment, UserRole } from "@/types";

export interface SessionCommentWithAuthor extends SessionComment {
  author_display_name: string | null;
  author_role: UserRole;
}

type ServiceErrorCode = "not_found";

export type ListSessionCommentsResult =
  | { ok: true; data: SessionCommentWithAuthor[] }
  | { ok: false; code: ServiceErrorCode; message: string };

export type MutateSessionCommentResult =
  | { ok: true; data: SessionCommentWithAuthor }
  | { ok: false; code: ServiceErrorCode; message: string };

export type DeleteSessionCommentResult = { ok: true } | { ok: false; code: ServiceErrorCode; message: string };

interface CommentRow {
  id: string;
  session_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  profiles: { display_name: string | null; role: UserRole } | { display_name: string | null; role: UserRole }[] | null;
}

function unwrapProfile(profiles: CommentRow["profiles"]): { display_name: string | null; role: UserRole } | null {
  if (profiles == null) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}

function mapCommentRow(row: CommentRow): SessionCommentWithAuthor {
  const profile = unwrapProfile(row.profiles);

  return {
    id: row.id,
    session_id: row.session_id,
    author_id: row.author_id,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author_display_name: profile?.display_name ?? null,
    author_role: profile?.role ?? "client",
  };
}

const commentSelect = "id, session_id, author_id, body, created_at, updated_at, profiles(display_name, role)";

export async function listSessionComments(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<ListSessionCommentsResult> {
  const result = await supabase
    .from("session_comments")
    .select(commentSelect)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (result.error) {
    return { ok: false, code: "not_found", message: result.error.message };
  }

  return { ok: true, data: (result.data as CommentRow[]).map(mapCommentRow) };
}

export async function createSessionComment(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  body: string,
): Promise<MutateSessionCommentResult> {
  const insertResult = await supabase
    .from("session_comments")
    .insert({
      session_id: sessionId,
      author_id: userId,
      body,
    })
    .select(commentSelect)
    .single();

  if (insertResult.error) {
    return {
      ok: false,
      code: "not_found",
      message: insertResult.error.message,
    };
  }

  return { ok: true, data: mapCommentRow(insertResult.data) };
}

export async function updateSessionComment(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
  body: string,
): Promise<MutateSessionCommentResult> {
  const updateResult = await supabase
    .from("session_comments")
    .update({ body })
    .eq("id", commentId)
    .eq("author_id", userId)
    .select(commentSelect)
    .maybeSingle();

  if (updateResult.error) {
    return { ok: false, code: "not_found", message: updateResult.error.message };
  }

  if (!updateResult.data) {
    return { ok: false, code: "not_found", message: "Comment not found" };
  }

  return { ok: true, data: mapCommentRow(updateResult.data) };
}

export async function deleteSessionComment(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<DeleteSessionCommentResult> {
  const deleteResult = await supabase.from("session_comments").delete().eq("id", commentId).eq("author_id", userId);

  if (deleteResult.error) {
    return { ok: false, code: "not_found", message: deleteResult.error.message };
  }

  return { ok: true };
}
