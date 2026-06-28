import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SessionCommentWithAuthor, UserRole } from "@/types";

interface SessionCommentsThreadProps {
  sessionId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuthorBadge({ role, isMe }: { role: UserRole; isMe: boolean }) {
  if (isMe) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">
        You
      </span>
    );
  }

  if (role === "trainer") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
        Trainer
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-200">
      Client
    </span>
  );
}

interface CommentItemProps {
  comment: SessionCommentWithAuthor;
  currentUserId: string;
}

function CommentItem({ comment, currentUserId }: CommentItemProps) {
  const isMe = comment.author_id === currentUserId;

  return (
    <article className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white/90">{comment.author_display_name}</span>
        <AuthorBadge role={comment.author_role} isMe={isMe} />
        <time className="text-xs text-blue-100/50" dateTime={comment.created_at}>
          {formatTimestamp(comment.created_at)}
        </time>
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isMe
            ? "rounded-tr-sm bg-blue-600/30 text-white"
            : "rounded-tl-sm border border-white/10 bg-white/5 text-blue-100/90",
        )}
      >
        {comment.body}
      </div>
    </article>
  );
}

export default function SessionCommentsThread({
  sessionId,
  currentUserId,
  currentUserRole,
}: SessionCommentsThreadProps) {
  const [comments, setComments] = useState<SessionCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/comments`, { signal: controller.signal });
        if (!res.ok) {
          setFetchError("Failed to load comments");
          return;
        }
        const json = (await res.json()) as { comments: SessionCommentWithAuthor[] };
        setComments(json.comments);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setFetchError("Failed to load comments");
      } finally {
        setLoading(false);
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, loading]);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string; details?: { message?: string } };
        setSubmitError(json.details?.message ?? json.error ?? "Failed to send comment");
        return;
      }

      const json = (await res.json()) as { comment: SessionCommentWithAuthor };
      setComments((prev) => [...prev, json.comment]);
      setDraft("");
    } catch {
      setSubmitError("Failed to send comment");
    } finally {
      setSubmitting(false);
    }
  }

  void currentUserRole;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <h2 className="mb-4 text-sm font-medium text-blue-100/80">Comments</h2>

      {loading ? (
        <div className="py-6 text-center text-sm text-blue-100/50">Loading…</div>
      ) : fetchError ? (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {fetchError}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-blue-100/50">No comments yet</p>
      ) : (
        <div className="mb-4 space-y-4">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} currentUserId={currentUserId} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {!loading && !fetchError && comments.length > 0 ? <div ref={bottomRef} /> : null}

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="mt-4 space-y-2"
      >
        <Textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          placeholder="Write a comment…"
          rows={3}
          maxLength={2000}
          className="resize-none border-white/20 bg-white/5 text-white placeholder:text-blue-100/40 focus-visible:ring-white/30"
          disabled={submitting}
          aria-label="Comment text"
        />
        {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={!draft.trim() || submitting} className="min-h-9">
            {submitting ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </section>
  );
}
