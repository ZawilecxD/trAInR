---
change_id: client-removal
title: Client removal
status: implemented
created: 2026-06-05
updated: 2026-06-05
archived_at: null
linear_issue: ZAW-16
phase_issues:
  "1": ZAW-28
  "2": ZAW-27
---

## Notes

S-11 (FR-006): trainer can remove or reject a wrongly-assigned client. Prerequisite S-03 done (`/trainer/clients`, invite flow). Soft removal via `trainer_clients.status` + `removed_at`; retain client data; trainer no longer sees removed client. Extend `/trainer/clients` UX only — no S-04/S-07 scope.
