---
change_id: training-plan-import-export
title: Trainer session-template import/export (JSON + XLSX)
status: implementing
created: 2026-08-25
updated: 2026-08-25
archived_at: null
linear_issue: ZAW-57
---

## Notes

ZAW-57 originally specified JSON export/import of an assigned client’s active plan (sessions written onto that calendar). After framing, scope is: trainer-only import/export of **session templates** (prescription only) as JSON and XLSX; no `set_logs`; placing onto a client calendar stays the existing day-by-day flow. See `frame.md`.

### Deferred manual verification (run at PR)

Per implementer: skip per-phase manual gates; verify all of these once the PR exists. Leave Progress `#### Manual` rows unchecked until then.

- **1.5** Local Supabase: “Squat” then “squat” rejected; second trainer can create “Squat”
- **1.6** Studio script with begin/set local role/JWT/rollback documents pass/fail per statement
- **2.5** Optional fixture DTO spot-check (or skip if unit fixtures suffice)
- **3.4** GET export JSON downloads without UUIDs
- **3.5** Preview/commit create, overwrite, skip
- **3.6** Unknown exercise name → 400, library unchanged
- **3.7** Other trainer export id → 404
- **4.4** Export opens in Excel/LibreOffice, one row per set
- **4.5** Re-import after a cell edit
- **4.6** Garbled file → fix-list, no write
- **5.3** Hub: export JSON/XLSX, import create, clash overwrite/skip, unknown name fix-list
- **5.4** Client calendar: add session from imported template
- **5.5** Client user cannot call import/export APIs (403)
- **5.6** Linear ZAW-57 description matches this plan
