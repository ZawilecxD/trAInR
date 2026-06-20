---
change_id: trainer-dashboard
title: Trainer dashboard (S-07)
status: implementing
linear_issue: ZAW-12
created: 2026-06-20
updated: 2026-06-20
archived_at: null
---

## Notes

Roadmap slice S-07. Trainer sees a dashboard overview of active clients, assigned plans, and recent logged session activity, then reviews session actuals in a read-only view. This plan also includes the Pencil-driven `/trainer/clients` roster refresh because it supports the same trainer overview workflow.

Scope decisions from planning:
- Include dashboard + richer clients roster.
- Exclude the exercise-library modal redesign from this slice.
- Do not surface missed sessions yet.
- Keep `/trainer/clients/[clientId]/sessions/[sessionId]` as the route, splitting behavior between pre-start editing and post-start read-only review.
