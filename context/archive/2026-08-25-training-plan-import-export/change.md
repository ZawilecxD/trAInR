---
change_id: training-plan-import-export
title: Trainer session-template import/export (JSON + XLSX)
status: archived
created: 2026-08-25
updated: 2026-09-19
archived_at: 2026-09-19T10:44:54Z
linear_issue: ZAW-57
---

## Notes

ZAW-57 originally specified JSON export/import of an assigned client’s active plan (sessions written onto that calendar). After framing, scope is: trainer-only import/export of **session templates** (prescription only) as JSON and XLSX; no `set_logs`; placing onto a client calendar stays the existing day-by-day flow. See `frame.md`.

### Deferred manual verification (run at PR)

Verified 2026-08-29 against local Supabase + `http://127.0.0.1:4321`. XLSX 4.4–4.6 + hub file UX confirmed by Mateusz; remaining gates via SQL (1.6 rollback) and trainer/client API calls.

- **1.5** PASS — trainer A `Squat` 201, `squat` 409 `duplicate_name`, trainer B `Squat` 201
- **1.6** PASS — Studio-style `begin` / JWT / `auth.uid()` / rollback; CI unique + RLS documented
- **2.5** SKIP — unit fixtures suffice
- **3.4** PASS — export of “Import Export example” has no UUIDs / `exercise_id` / `set_logs`
- **3.5** PASS — preview create → commit create / skip / overwrite (reps written to 99)
- **3.6** PASS — unknown name 400 fix-list; template library unchanged
- **3.7** PASS — trainer B export of trainer A id → 404
- **4.4–4.6** PASS — Mateusz manual XLSX
- **5.3** PASS — API covers create / clash / skip / overwrite / unknown; XLSX hub by Mateusz
- **5.4** PASS — `POST /api/workout-sessions` from imported template (`source_template_id` set, 201)
- **5.5** PASS — client export/preview/commit → 403
- **5.6** PASS — Linear ZAW-57 description matches framed template JSON+XLSX scope
