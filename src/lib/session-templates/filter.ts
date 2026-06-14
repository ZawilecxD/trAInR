import type { TemplateFilterState } from "@/lib/session-templates/filter-url";
import type { SessionTemplateSummary } from "@/lib/session-templates/service";

export function filterTemplateSummaries(
  templates: SessionTemplateSummary[],
  filters: TemplateFilterState,
): SessionTemplateSummary[] {
  return templates.filter((template) => {
    if (filters.q) {
      const query = filters.q.toLowerCase();
      const haystack = `${template.name} ${template.description ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (filters.phase && !template.phases.includes(filters.phase)) {
      return false;
    }

    return true;
  });
}
