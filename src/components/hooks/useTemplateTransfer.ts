import { useState } from "react";

import type { ImportPreviewSuccess } from "@/lib/session-templates/transfer-import";

export interface TransferIssue {
  path: string;
  message: string;
}

export interface ImportPreviewState extends ImportPreviewSuccess {
  document?: unknown;
  source: "json" | "xlsx";
  file?: File;
}

interface UseTemplateTransferOptions {
  onImported: (message: string) => Promise<void>;
}

async function parseJsonError(response: Response): Promise<{
  error?: string;
  details?: { issues?: TransferIssue[]; message?: string };
}> {
  try {
    return (await response.json()) as {
      error?: string;
      details?: { issues?: TransferIssue[]; message?: string };
    };
  } catch {
    return {};
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useTemplateTransfer({ onImported }: UseTemplateTransferOptions) {
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewState | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [issues, setIssues] = useState<TransferIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportTemplate(templateId: string, format: "json" | "xlsx") {
    setExportingId(`${templateId}:${format}`);
    setError(null);
    try {
      const response = await fetch(`/api/session-templates/${templateId}/export?format=${format}`);
      if (!response.ok) {
        const payload = await parseJsonError(response);
        throw new Error(payload.details?.message ?? payload.error ?? "Export failed.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `template.${format}`;
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExportingId(null);
    }
  }

  async function handleFileSelected(file: File | undefined) {
    if (!file) {
      return;
    }

    setImportBusy(true);
    setError(null);
    setIssues(null);

    try {
      const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
      let response: Response;
      let document: unknown;

      if (isXlsx) {
        const form = new FormData();
        form.append("file", file);
        response = await fetch("/api/session-templates/import/preview", {
          method: "POST",
          body: form,
        });
      } else {
        const text = await file.text();
        document = JSON.parse(text) as unknown;
        response = await fetch("/api/session-templates/import/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: "json", document }),
        });
      }

      if (!response.ok) {
        const payload = await parseJsonError(response);
        if (payload.details?.issues) {
          setIssues(payload.details.issues);
          return;
        }
        throw new Error(payload.details?.message ?? payload.error ?? "Import preview failed.");
      }

      const previewPayload = (await response.json()) as ImportPreviewSuccess;
      setPreview({
        ...previewPayload,
        document: isXlsx ? undefined : document,
        source: isXlsx ? "xlsx" : "json",
        file: isXlsx ? file : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import preview failed.");
    } finally {
      setImportBusy(false);
    }
  }

  async function commitImport(action: "create" | "skip" | "overwrite") {
    if (!preview) {
      return;
    }

    setImportBusy(true);
    setError(null);
    setIssues(null);

    try {
      let response: Response;

      if (preview.source === "xlsx" && preview.file) {
        const form = new FormData();
        form.append("file", preview.file);
        form.append("action", action);
        response = await fetch("/api/session-templates/import/commit", {
          method: "POST",
          body: form,
        });
      } else {
        response = await fetch("/api/session-templates/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: "json",
            document: preview.document,
            action,
          }),
        });
      }

      if (!response.ok) {
        const payload = await parseJsonError(response);
        if (payload.details?.issues) {
          setIssues(payload.details.issues);
          return;
        }
        throw new Error(payload.details?.message ?? payload.error ?? "Import commit failed.");
      }

      setPreview(null);
      const message =
        action === "skip" ? "Import skipped." : action === "overwrite" ? "Template overwritten." : "Template imported.";
      await onImported(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import commit failed.");
    } finally {
      setImportBusy(false);
    }
  }

  function closePreview() {
    setPreview(null);
    setIssues(null);
  }

  return {
    exportingId,
    preview,
    importBusy,
    issues,
    error,
    exportTemplate,
    handleFileSelected,
    commitImport,
    closePreview,
  };
}
