import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ImportPreviewState, TransferIssue } from "@/components/hooks/useTemplateTransfer";
import { cn } from "@/lib/utils";

interface TemplateImportDialogProps {
  preview: ImportPreviewState | null;
  issues: TransferIssue[] | null;
  busy: boolean;
  onClose: () => void;
  onCommit: (action: "create" | "skip" | "overwrite") => void;
}

export default function TemplateImportDialog({ preview, issues, busy, onClose, onCommit }: TemplateImportDialogProps) {
  const open = preview !== null || (issues !== null && issues.length > 0);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <AlertDialogContent className="border-border bg-popover text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>{issues?.length ? "Import needs fixes" : "Import template"}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {issues?.length
              ? "Fix the issues below and try again. Nothing was written."
              : preview
                ? `Ready to import “${preview.summary.name}” (${preview.summary.exercise_count} exercise${preview.summary.exercise_count === 1 ? "" : "s"}).`
                : null}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {issues && issues.length > 0 ? (
          <ul className="text-destructive max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
            {issues.map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>
                <span className="text-muted-foreground">{issue.path}: </span>
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}

        {preview && !issues?.length ? (
          <div className="text-muted-foreground space-y-2 text-sm">
            {preview.action_needed === "choose" && preview.existing_template ? (
              <p>
                A template named <span className="text-foreground font-medium">{preview.existing_template.name}</span>{" "}
                already exists. Overwrite it, skip the import, or cancel.
              </p>
            ) : (
              <p>No name clash — this will create a new template in your library.</p>
            )}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel className="border-border bg-muted text-foreground hover:bg-accent" disabled={busy}>
            Cancel
          </AlertDialogCancel>
          {preview && !issues?.length && preview.action_needed === "create" ? (
            <Button
              type="button"
              className={cn("bg-primary text-primary-foreground hover:bg-primary/90")}
              disabled={busy}
              onClick={() => {
                onCommit("create");
              }}
            >
              {busy ? "Importing…" : "Create"}
            </Button>
          ) : null}
          {preview && !issues?.length && preview.action_needed === "choose" ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="border-border bg-transparent"
                disabled={busy}
                onClick={() => {
                  onCommit("skip");
                }}
              >
                Skip
              </Button>
              <Button
                type="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={busy}
                onClick={() => {
                  onCommit("overwrite");
                }}
              >
                {busy ? "Saving…" : "Overwrite"}
              </Button>
            </>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
