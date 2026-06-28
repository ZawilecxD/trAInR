import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateSessionCommentBody } from "@/lib/session-comments/schemas";
import type { SessionCommentWithAuthor, UserRole } from "@/types";

interface CommentRow {
  id: string;
  session_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  profiles: { display_name: string; role: string } | null;
}

function mapRow(row: CommentRow): SessionCommentWithAuthor {
  return {
    id: row.id,
    session_id: row.session_id,
    author_id: row.author_id,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author_display_name: row.profiles?.display_name ?? "Unknown",
    author_role: (row.profiles?.role ?? "client") as UserRole,
  };
}

export async function listSessionComments(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ data: SessionCommentWithAuthor[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("session_comments")
    .select("*, profiles!author_id(display_name, role)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data as CommentRow[]).map(mapRow), error: null };
}

type CreateSessionCommentErrorCode = "not_found" | "validation_error";

export type CreateSessionCommentResult =
  | { ok: true; data: SessionCommentWithAuthor }
  | { ok: false; code: CreateSessionCommentErrorCode; message: string };

export async function createSessionComment(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  body: CreateSessionCommentBody,
): Promise<CreateSessionCommentResult> {
  const sessionCheck = await supabase.from("workout_sessions").select("id").eq("id", sessionId).maybeSingle();

  if (sessionCheck.error || !sessionCheck.data) {
    return { ok: false, code: "not_found", message: "Session not found" };
  }

  const insertResult = await supabase
    .from("session_comments")
    .insert({ session_id: sessionId, author_id: userId, body: body.body })
    .select("*, profiles!author_id(display_name, role)")
    .single();

  if (insertResult.error) {
    return { ok: false, code: "validation_error", message: insertResult.error.message };
  }

  return { ok: true, data: mapRow(insertResult.data as CommentRow) };
}
