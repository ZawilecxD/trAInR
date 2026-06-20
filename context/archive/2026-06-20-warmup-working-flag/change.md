---
change_id: warmup-working-flag
title: Warm-up vs working per prescribed round and logged set
status: archived
created: 2026-06-20
updated: 2026-06-20
archived_at: 2026-06-20T18:27:06Z
---

## Notes

S-10 (FR-018): trainer marks each prescribed round warm-up or working in templates and assigned sessions; client logs inherit the prescribed default and may override; only working logged sets count toward stats/hints.

**Phase vs round flag:** session exercise **phase** (`warm_up` / `main` / `cool_down`) is unchanged structurally, but Phase 2 UI ties `is_warmup` to phase for trainer prescription:

- **Warm-up phase** — toggle hidden; all rounds persist `is_warmup = true`
- **Main phase** — toggle shown per round (trainer choice)
- **Cool-down phase** — toggle hidden; all rounds persist `is_warmup = false`

Client logging still shows the warm-up/working toggle on every log row (full labels; compact `text-[11px]` + `min-w-[4.25rem]` so labels stay on one line in the set table).
