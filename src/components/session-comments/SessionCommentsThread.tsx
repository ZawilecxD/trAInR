import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorBannerClass, surfaceCardClass } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { SessionCommentWithAuthor, UserRole } from "@/types";

interface SessionCommentsThreadProps {
  sessionId: string;
  currentUserId: string;
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
      <span className="label-caps border-border bg-muted text-foreground/80 inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5">
        You
      </span>
    );
  }

  if (role === "trainer") {
    return (
      <span className="label-caps border-warning/30 bg-warning/10 text-warning inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5">
        Trainer
      </span>
    );
  }

  return (
    <span className="label-caps border-primary/30 bg-primary/10 text-text-soft inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5">
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
        <span className="text-foreground/90 text-sm font-medium">{comment.author_display_name}</span>
        <AuthorBadge role={comment.author_role} isMe={isMe} />
        <time className="text-muted-foreground text-xs" dateTime={comment.created_at}>
          {formatTimestamp(comment.created_at)}
        </time>
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isMe
            ? "bg-primary/30 text-foreground rounded-tr-sm"
            : "border-border bg-card text-foreground/90 rounded-tl-sm border",
        )}
      >
        {comment.body}
      </div>
    </article>
  );
}

export default function SessionCommentsThread({ sessionId, currentUserId }: SessionCommentsThreadProps) {
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

  return (
    <section className={cn(surfaceCardClass, "p-5")}>
      <h2 className="text-text-soft label-caps mb-4">Comments</h2>

      {loading ? (
        <div className="text-muted-foreground py-6 text-center text-sm">Loading…</div>
      ) : fetchError ? (
        <div className={errorBannerClass}>{fetchError}</div>
      ) : comments.length === 0 ? (
        <EmptyState title="No comments yet" description="Start the thread below." className="mb-4 border-dashed" />
      ) : (
        <div className="mb-4 space-y-4">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} currentUserId={currentUserId} />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

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
          className="border-input bg-popover placeholder:text-muted-foreground text-foreground focus-visible:ring-ring resize-none"
          disabled={submitting}
          aria-label="Comment text"
        />
        {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!draft.trim() || submitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11"
          >
            {submitting ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </section>
  );
}
