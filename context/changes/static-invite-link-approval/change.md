---
change_id: static-invite-link-approval
title: Static per-trainer invite link + trainer approval
status: preparing
created: 2026-06-07
updated: 2026-06-07
linear_issue:
---

## Notes

Research-only spike (no code yet). Evaluates replacing the current per-client
**single-use** invite links (S-03) with **one static reusable link per trainer**
plus a **trainer-approval gate**: a client self-registers via the link, the
trainer sees the email they registered with and must ACCEPT before the client
account activates / can log in.

Decision memo + recommendation + migration sketch in `research.md`.
Driving questions: client-UX cost of the approval gate, other risks/chances,
and known best practices from existing coaching apps.
