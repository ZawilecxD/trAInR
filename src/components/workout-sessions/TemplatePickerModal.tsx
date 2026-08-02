import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionTemplate } from "@/types";

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  templates: SessionTemplate[];
  clientId: string;
  scheduledDate: string;
}

export default function TemplatePickerModal({
  open,
  onClose,
  templates,
  clientId,
  scheduledDate,
}: TemplatePickerModalProps) {
  if (!open) {
    return null;
  }

  const dateQuery = encodeURIComponent(scheduledDate);
  const basePath = `/trainer/clients/${clientId}/sessions/new?date=${dateQuery}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-picker-title"
    >
      <div className="border-border bg-popover max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border shadow-xl">
        <div className="border-border border-b px-5 py-4">
          <h2 id="template-picker-title" className="text-foreground text-lg font-semibold">
            Add session
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">Choose a template or start with a blank session.</p>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-4">
          {templates.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No templates yet. Start with a blank session or create templates first.
            </p>
          ) : (
            templates.map((template) => (
              <a
                key={template.id}
                href={`${basePath}&templateId=${encodeURIComponent(template.id)}`}
                className="border-border bg-card hover:bg-accent flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors"
              >
                <FileText className="text-text-lavender mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="text-foreground block font-medium">{template.name}</span>
                  {template.description ? (
                    <span className="text-muted-foreground mt-0.5 block truncate text-sm">{template.description}</span>
                  ) : null}
                </span>
              </a>
            ))
          )}
        </div>

        <div className="border-border flex flex-col gap-2 border-t px-5 py-4 sm:flex-row sm:justify-between">
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => {
              window.location.assign(basePath);
            }}
          >
            <Plus className="size-4" />
            Blank session
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-border hover:bg-accent text-foreground bg-transparent"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
