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
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 id="template-picker-title" className="text-lg font-semibold text-white">
            Add session
          </h2>
          <p className="mt-1 text-sm text-blue-100/70">Choose a template or start with a blank session.</p>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-4">
          {templates.length === 0 ? (
            <p className="text-sm text-blue-100/60">
              No templates yet. Start with a blank session or create templates first.
            </p>
          ) : (
            templates.map((template) => (
              <a
                key={template.id}
                href={`${basePath}&templateId=${encodeURIComponent(template.id)}`}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-purple-300" />
                <span className="min-w-0">
                  <span className="block font-medium text-white">{template.name}</span>
                  {template.description ? (
                    <span className="mt-0.5 block truncate text-sm text-blue-100/60">{template.description}</span>
                  ) : null}
                </span>
              </a>
            ))
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-4 sm:flex-row sm:justify-between">
          <Button
            type="button"
            className="bg-purple-500 text-white hover:bg-purple-500/90"
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
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
