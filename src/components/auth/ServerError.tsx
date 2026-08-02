import { CircleAlert } from "lucide-react";

import { errorBannerCompactClass } from "@/lib/ui-classes";

interface ServerErrorProps {
  message?: string | null;
}

export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p className={errorBannerCompactClass}>
      <CircleAlert className="size-4 shrink-0" />
      {message}
    </p>
  );
}
