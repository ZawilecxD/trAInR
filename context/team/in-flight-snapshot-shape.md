---
project: null
context_type: brownfield
created: 2026-08-13
updated: 2026-08-14
notes_path: context/team/in-flight-snapshot-shape.md
source_opportunity: context/team/opportunity-map.md
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "change category"
      decision: "new side helper — generate a local snapshot; Linear, GitHub, roadmap, and change folders stay the systems of record"
    - topic: "insight"
      decision: "none of Linear, GitHub, or the roadmap answers re-entry alone — status, next, dependencies, and recently merged live in different places"
    - topic: "persona scope"
      decision: "just Mateusz — solo builder coming back every few days"
    - topic: "must preserve"
      decision: "Linear, GitHub, roadmap.md, and context/changes stay editable only in those tools; helper is not a second tracker"
    - topic: "stale close-out"
      decision: "helper detects what is not closed/archived but should be according to git and Linear status; it flags, it does not close or archive"
    - topic: "auth strategy"
      decision: "N/A — single user, single device, no login"
    - topic: "role model"
      decision: "no roles — only Mateusz; trAInR trainer/client roles unused by this helper"
    - topic: "mvp sources"
      decision: "first glance includes all four sources: roadmap, Linear, GitHub PRs/branches, git/change folders"
    - topic: "blast radius"
      decision: "helper only — trAInR coaching app must not change"
    - topic: "secondary"
      decision: "rows joined by the same change identifier, with an obvious gap when an id is missing"
    - topic: "guardrail"
      decision: "helper never writes to Linear, GitHub, roadmap, or change folders"
    - topic: "FR-005 prompt-fill"
      decision: "dropped from MVP; use /10x-goal-implement or a hand-written prompt"
    - topic: "FR-004 queue"
      decision: "next-up is the roadmap’s order; do not invent a second queue"
    - topic: "FR-002 flags"
      decision: "close/archive flags are conservative — omit when unsure"
    - topic: "FR-006 freshness"
      decision: "status is generated on each run, not a stored dashboard"
    - topic: "FR-007 write-back"
      decision: "read-only for v1; write-back is an explicit later non-goal until proven"
    - topic: "domain rule"
      decision: "new rule — classify into buckets; close/archive flag only when git and Linear are clear"
    - topic: "nfr freshness"
      decision: "status is only as current as this run — no stored official status"
    - topic: "constraints"
      decision: "no data migration; Linear, GitHub, roadmap, and change folders keep their current contracts"
    - topic: "product surface"
      decision: "trAInR stays the coaching web app; helper is an extra local page for Mateusz only"
    - topic: "user base"
      decision: "still just Mateusz — not changing"
    - topic: "deadline"
      decision: "no hard deadline"
    - topic: "when work"
      decision: "after-hours / evenings"
  frs_drafted: 7
  quality_check_status: accepted
---

# Shape notes — in-flight snapshot (working name)

Side helper for the trAInR builder workflow. Not a change to the coaching product. Product shape remains `context/foundation/shape-notes.md`.

## Seed idea (verbatim)

maybe a visualization (html nice to eye and simple page that shows current state of the project by gathering information from roadmap and linear and github

## Current System

Linear issues, GitHub PRs and branches, `roadmap.md`, and `context/changes` folders are how work is tracked. The same slice is supposed to share one change identifier across those places.

New ideas are often written into the roadmap; a related Linear issue is sometimes not created. Linear issues and change folders are often left open or unarchived after the work is done.

There is no single view of status, what’s next, what depends on what, and what recently merged. After a few days away, those facts have to be reconstituted by opening the three (four) sources and merging them in your head.

## Vision & Problem Statement

You come back to the project every few days and have forgotten the status of changes, what to implement next, what depends on what, and what was recently merged. Forgotten close/archive and roadmap rows without Linear issues add to the chaos. Reconstituting that picture takes time before work can continue.

None of Linear, GitHub, or the roadmap answers that re-entry question alone. The change is a generated local snapshot that puts those sources in one place, joined by the same change identifier when it exists and showing gaps when it doesn’t — including work that git and Linear status say should already be closed or archived. The helper does not write to Linear, GitHub, the roadmap, or change folders.

## User & Persona

### Primary persona

**Role:** Mateusz — solo builder of trAInR
**Context:** Returns to the project every few days. Uses Linear, GitHub PRs/branches, `roadmap.md`, and `context/changes`.
**Moment they reach for this:** Sitting down after days away, before they can continue — needing current status, next slice, dependencies, recently merged work, and leftover issues/folders that should already be closed or archived.

## Access Control

No changes planned — current trAInR auth (trainer/client login) is preserved and unused by this helper.

**Helper:** N/A — single user, single device, no login, no roles. Open a local page on this machine. Not a multi-user surface.

## Success Criteria

### Primary

The day-start glance works. After days away you run the helper as the first action of the day and, on one local page, can see recently done, currently in progress, and what to target next — from roadmap, Linear, GitHub PRs/branches, and git/change folders. Leftovers that git and Linear status say should already be closed or archived, and hanging PRs, are visible so you can then close/archive, review/merge, continue in-progress work, and plan/start the next queue item in those source tools.

1. Sit down after days away.
2. Run the helper.
3. Glance: recently done, in progress, next to target.
4. See leftover close/archive flags and hanging PRs.
5. Leave the helper; close/archive, merge PRs, deliver in-progress, then plan/start next — in Linear, GitHub, and the repo.

### Secondary

Rows are joined by the same change identifier when it exists, with an obvious gap when an id is missing.

### Guardrails

- The helper never writes to Linear, GitHub, `roadmap.md`, or `context/changes`.
- The trAInR coaching app is unchanged (blast radius is the helper only).

## Functional Requirements

- FR-001: Builder can see the status of ongoing topics and whether they are related. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: none. Resolution: kept as written.
- FR-002: Builder can see topics that should be closed or archived, only when git and Linear status make that clear; omit the flag when unsure. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: a false “should archive” flag could close the wrong issue. Resolution: flags are conservative — omit when unsure.
- FR-003: Builder can see hanging PRs to review. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: none. Resolution: kept as written.
- FR-004: Builder can see the next topics in the queue as the roadmap already orders them — not a second, derived queue. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: the roadmap already is the queue; a parallel next-up list will disagree with it. Resolution: show the roadmap’s order; do not invent another queue.
- FR-005: Builder can get a filled prompt template for a specific change to copy into a Cursor agent. Priority: dropped from MVP. Change: new
  > Socrates: Counter-argument considered: use /10x-goal-implement or a hand-written prompt instead of generating one. Resolution: dropped from this MVP.
- FR-006: Builder can see whole-system status in one place, generated on each run: the helper aggregates Linear, GitHub, roadmap, and change folders and surfaces inconsistencies. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: if it isn’t run every session, it becomes another stale dashboard. Resolution: generate on each run; do not store a second status.
- FR-007: Linear, GitHub, roadmap, and change folders stay editable only in those tools; the helper does not write to them. Priority: must-have. Change: preserved
  > Socrates: Counter-argument considered: read-only lists chaos but doesn’t remove it. Resolution: read-only is right for v1; write-back (close issue, archive folder) is an explicit later non-goal until proven.

## User Stories

### US-01: Day-start glance

**Before:** After days away, open Linear, GitHub, and the roadmap and merge them in your head.

**Given** I sat down after days away  
**When** I run the helper (fresh generate)  
**Then** I see ongoing topics (and whether they are related), conservative close/archive flags, hanging PRs, the roadmap’s next queue, and inconsistencies — and I do close/archive, merge, and next work in the source tools, not in the helper

US-02 (copy-paste implement prompt) removed from this MVP — see FR-005.

## Business Logic

The helper classifies each topic into a bucket (ongoing / close-archive / hanging PR / next on the roadmap) and only flags close/archive when git and Linear status make that clear.

This is a new rule. Today that classification happens in your head across four sources.

It consumes the current picture of those sources (Linear issues, GitHub PRs and branches, roadmap rows, change folders). It outputs each topic in a bucket, relatedness where identifiers join, inconsistencies where they don’t, and a close/archive flag only when the sources agree it is due. You encounter it on the day-start page after you run the helper — topics already in buckets; a close/archive flag only when present.

## Constraints & Preserved Behavior

- No data migration.
- Linear, GitHub, `roadmap.md`, and `context/changes` keep their current contracts; this change does not alter them.
- The helper does not become a second tracker or a published status store.
- The trAInR coaching app is unchanged.

## Non-Functional Requirements

- Freshness: what you see is only as current as this run. There is no stored “official” status to treat as live later.

## Non-Goals

- Writing to Linear, GitHub, `roadmap.md`, or `context/changes` — sources stay the record; helper is read-only.
- A second next-up list that isn’t the roadmap’s order — next is the roadmap, not a derived queue.
- Shipping this as a screen in the coaching app — local side page only.
- History, charts, or a stored dashboard — generate on each run, then throw away.
- Orchestrating multiple agents — out of scope; start a slice with `/10x-goal-implement` if needed.

Prompt-fill for Cursor agents is already out of this MVP (FR-005), even though it was not re-picked in this list.

## Quality cross-check

All brownfield elements present. No gaps recorded.

- Access Control: present (N/A local, no login)
- Business Logic: present (one-sentence classify + conservative close/archive flag)
- Project artifacts: present (`context/team/in-flight-snapshot-shape.md`)
- Timeline-cost: present (`delivery_weeks: 1`)
- Non-Goals: present
- Preserved behavior: present

Working name remains “in-flight snapshot”; `project` in frontmatter is still unset. Do not run `/10x-prd` against `context/foundation/prd.md` — that file is the coaching product.
