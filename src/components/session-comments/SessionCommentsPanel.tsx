import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SessionCommentWithAuthor } from "@/lib/session-comments/service";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface SessionCommentsPanelProps {
  sessionId: string;
  currentUserId: string;
}

interface CommentsResponse {
  comments?: SessionCommentWithAuthor[];
  error?: string;
  details?: { message?: string; issues?: unknown };
}

interface CommentResponse {
  comment?: SessionCommentWithAuthor;
  error?: string;
  details?: { message?: string; issues?: unknown };
}

function roleLabel(role: UserRole): string {
  return role === "trainer" ? "Trainer" : "Client";
}

function authorName(comment: SessionCommentWithAuthor): string {
  return comment.author_display_name?.trim() ?? roleLabel(comment.author_role);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseError(body: CommentsResponse | CommentResponse, status: number): string {
  return body.details?.message ?? body.error ?? `Request failed (${status})`;
}

export default function SessionCommentsPanel({ sessionId, currentUserId }: SessionCommentsPanelProps) {
  const [comments, setComments] = useState<SessionCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`);
      const body = (await response.json()) as CommentsResponse;

      if (!response.ok) {
        throw new Error(parseError(body, response.status));
      }

      setComments(body.comments ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    // Data fetch on mount — standard pattern for Astro React islands
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch updates state after await
    void loadComments();
  }, [loadComments]);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const bodyText = draft.trim();
    if (!bodyText || submitPending) return;

    setSubmitPending(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyText }),
      });
      const body = (await response.json()) as CommentResponse;

      if (!response.ok || !body.comment) {
        throw new Error(parseError(body, response.status));
      }

      const created = body.comment;
      setComments((prev) => [...prev, created]);
      setDraft("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to post comment");
    } finally {
      setSubmitPending(false);
    }
  }

  function startEdit(comment: SessionCommentWithAuthor) {
    setEditingId(comment.id);
    setEditDraft(comment.body);
    setSubmitError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function handleSaveEdit(commentId: string) {
    const bodyText = editDraft.trim();
    if (!bodyText || actionPendingId) return;

    setActionPendingId(commentId);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_id: commentId, body: bodyText }),
      });
      const body = (await response.json()) as CommentResponse;

      if (!response.ok || !body.comment) {
        throw new Error(parseError(body, response.status));
      }

      const updated = body.comment;
      setComments((prev) => prev.map((comment) => (comment.id === commentId ? updated : comment)));
      cancelEdit();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update comment");
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleDelete(commentId: string) {
    if (actionPendingId) return;

    setActionPendingId(commentId);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments?comment_id=${commentId}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; details?: { message?: string } };

      if (!response.ok) {
        throw new Error(body.details?.message ?? body.error ?? `Request failed (${response.status})`);
      }

      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      if (editingId === commentId) {
        cancelEdit();
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to delete comment");
    } finally {
      setActionPendingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <h2 className="text-sm font-medium text-blue-100/80">Session comments</h2>

      {loading ? (
        <p className="mt-4 text-sm text-blue-100/60">Loading comments…</p>
      ) : loadError ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {loadError}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadComments();
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-blue-100/60">No comments yet. Start the conversation below.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => {
                const isOwn = comment.author_id === currentUserId;
                const isEditing = editingId === comment.id;

                return (
                  <li
                    key={comment.id}
                    className={cn(
                      "rounded-xl border px-4 py-3",
                      isOwn ? "border-purple-400/30 bg-purple-500/10" : "border-white/10 bg-white/5",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">{authorName(comment)}</p>
                        <p className="text-xs text-blue-100/60">
                          {roleLabel(comment.author_role)} · {formatTimestamp(comment.created_at)}
                          {comment.updated_at ? " · edited" : null}
                        </p>
                      </div>
                      {isOwn && !isEditing ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-blue-100/70 hover:text-white"
                            disabled={actionPendingId !== null}
                            onClick={() => {
                              startEdit(comment);
                            }}
                            aria-label="Edit comment"
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-200/80 hover:text-red-100"
                            disabled={actionPendingId !== null}
                            onClick={() => {
                              void handleDelete(comment.id);
                            }}
                            aria-label="Delete comment"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={editDraft}
                          onChange={(event) => {
                            setEditDraft(event.target.value);
                          }}
                          rows={3}
                          className={cn(
                            "border-input w-full resize-y rounded-md border bg-slate-950/60 px-3 py-2 text-sm text-white",
                            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                          )}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!editDraft.trim() || actionPendingId === comment.id}
                            onClick={() => {
                              void handleSaveEdit(comment.id);
                            }}
                          >
                            {actionPendingId === comment.id ? "Saving…" : "Save"}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-white/90">{comment.body}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <form
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="space-y-3 border-t border-white/10 pt-4"
          >
            <label htmlFor={`comment-draft-${sessionId}`} className="sr-only">
              New comment
            </label>
            <textarea
              id={`comment-draft-${sessionId}`}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              rows={3}
              placeholder="Leave a note for your trainer or client…"
              className={cn(
                "border-input w-full resize-y rounded-md border bg-slate-950/60 px-3 py-2 text-sm text-white",
                "focus-visible:border-ring focus-visible:ring-ring/50 placeholder:text-blue-100/40 focus-visible:outline-none",
              )}
            />
            {submitError ? (
              <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {submitError}
              </p>
            ) : null}
            <Button type="submit" className="min-h-11" disabled={!draft.trim() || submitPending}>
              {submitPending ? "Posting…" : "Post comment"}
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
