import type { ReactElement, ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogBaseProps {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

type DeleteConfirmDialogControlledProps = DeleteConfirmDialogBaseProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: never;
};

type DeleteConfirmDialogTriggerProps = DeleteConfirmDialogBaseProps & {
  trigger: ReactElement;
  open?: never;
  onOpenChange?: never;
};

export type DeleteConfirmDialogProps = DeleteConfirmDialogControlledProps | DeleteConfirmDialogTriggerProps;

const dialogContentClass = "border-border bg-popover text-foreground";
const cancelClass = "border-border bg-muted text-foreground hover:bg-accent";
const confirmClass = "bg-destructive hover:bg-destructive/90 text-destructive-foreground";

function DeleteConfirmDialogContent({
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  controlled = false,
}: DeleteConfirmDialogBaseProps & { controlled?: boolean }) {
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription className="text-muted-foreground">{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className={cancelClass} disabled={loading}>
          {cancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          className={confirmClass}
          disabled={loading}
          onClick={(event) => {
            if (controlled) {
              event.preventDefault();
            }
            void onConfirm();
          }}
        >
          {loading ? "Deleting…" : confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export default function DeleteConfirmDialog(props: DeleteConfirmDialogProps) {
  if ("trigger" in props && props.trigger) {
    const { trigger, title, description, confirmLabel, cancelLabel, loading, onConfirm } = props;

    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
        <AlertDialogContent className={dialogContentClass}>
          <DeleteConfirmDialogContent
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            loading={loading}
            onConfirm={onConfirm}
          />
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const { open, onOpenChange, title, description, confirmLabel, cancelLabel, loading, onConfirm } = props;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={dialogContentClass}>
        <DeleteConfirmDialogContent
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          loading={loading}
          onConfirm={onConfirm}
          controlled
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
