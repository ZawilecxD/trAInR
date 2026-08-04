import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { formatEditWindowRemaining } from "@/lib/guided-workout/edit-window";
import { cn } from "@/lib/utils";

interface EditWindowBannerProps {
  lockedAt: string | null;
  hasLogs: boolean;
}

export default function EditWindowBanner({ lockedAt, hasLogs }: EditWindowBannerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  if (!hasLogs && !lockedAt) {
    return null;
  }

  const { status, label } = formatEditWindowRemaining(lockedAt, now);

  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        status === "sealed"
          ? "border-muted-foreground/40 bg-muted text-muted-foreground"
          : "border-primary/30 bg-primary/10 text-foreground",
      )}
      role="status"
    >
      {status === "sealed" ? <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
      <p>{label}</p>
    </div>
  );
}
