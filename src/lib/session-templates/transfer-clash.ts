import type { TransferIssue } from "@/lib/session-templates/transfer-schema";

export interface TemplateNameMatch {
  id: string;
  name: string;
}

export type TemplateNameClash =
  | { status: "create" }
  | { status: "choose"; existing_id: string; existing_name: string }
  | { status: "ambiguous"; issues: TransferIssue[] };

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function resolveTemplateNameClash(transferName: string, templates: TemplateNameMatch[]): TemplateNameClash {
  const key = normalizeName(transferName);
  const matches = templates.filter((template) => normalizeName(template.name) === key);

  if (matches.length === 0) {
    return { status: "create" };
  }

  if (matches.length === 1) {
    const only = matches[0];
    return {
      status: "choose",
      existing_id: only.id,
      existing_name: only.name,
    };
  }

  return {
    status: "ambiguous",
    issues: [
      {
        path: "name",
        message: "ambiguous template name; rename duplicates in the library",
      },
    ],
  };
}
