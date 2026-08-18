# Artifact 1 — Territory (git history)

Wide scan of where trAInR was actually touched. Input to `artifact-2-structure.md` and `repo-map.md`.

**Window:** 20 May 2026 – 13 Aug 2026 (repo is ~3 months old; “last 12 months” = whole history).
**First commit:** `055c1d2` Initial commit (20 May 2026).
**Commits:** 331 unique SHAs across `--all` refs.
**Metric:** change event = one commit touching one path (not lines changed).

## Method

- Count unique commits on **all refs**. `main` was rewritten around 2 July 2026; `git log` on `main` alone starts at `added s-21` and drops May–June work that still lives on feature branches.
- Filter noise: lockfiles, `package.json`, ESLint/Prettier/tsconfig/Astro/Vitest/Playwright configs, dotenv, `.gitignore`, generated dirs, PNG/`.pen`/snapshots, `.cursor` / `.agents` / `.github`, and `context/changes|archive|foundation` plan churn (`roadmap.md` alone: 43 touches).
- After filter: **784** kept events / **1895** total; **291** unique kept files; **125** commits touched kept files.
- Folders: merge `src/components/X` + `src/lib/X` into one module. Skip depth-1 buckets (`src`).
- Couplings: directory pairs/triples in the same commit. **Exclude 5 wide redesign commits (≥10 directories)** — they inflate UI-token pairs.
- Hub files: unique partner areas in commits spanning **2–9** directories (same wide-commit cut).

Prompt series also asked for a quarterly split. Not run as a separate pass: the window is one quarter plus a few weeks. Monthly commit counts below stand in for “how emphasis moved.”

## Activity over time

| Month | Unique commits | Note |
| --- | --- | --- |
| 2026-05 | 57 | Bootstrap, schema/RLS, exercise library |
| 2026-06 | **192** | Peak: logging, calendar, templates, comments, tests |
| 2026-07 | 66 | Guided-workout follow-ons (RPE, fill, edit window), UI redesign start |
| 2026-08 | 16 (through 13th) | UI redesign implement close-out |

`guided-workout` kept-file events by month: Jun 58, Jul 66, Aug 16 — the hottest module stayed hot after the June spike.

## TOP 10 modules

`src/components/X` and `src/lib/X` merged. Events = kept change events.

| # | Module | Events | Unique files | Paths |
| --- | --- | --- | --- | --- |
| 1 | guided-workout | 136 | 32 | `src/components/guided-workout` · `src/lib/guided-workout` |
| 2 | session-templates | 57 | 14 | `src/components/session-templates` · `src/lib/session-templates` |
| 3 | workout-sessions | 47 | 10 | `src/components/workout-sessions` · `src/lib/workout-sessions` |
| 4 | exercises | 34 | 15 | `src/components/exercises` · `src/lib/exercises` |
| 5 | plans | 32 | 5 | `src/components/plans` |
| 6 | supabase/migrations | 29 | 29 | `supabase/migrations` |
| 7 | tests/integration/rls | 27 | 17 | `tests/integration/rls` |
| 8 | pages/trainer/clients | 26 | 4 | `src/pages/trainer/clients` |
| 9 | auth | 24 | 7 | `src/components/auth` · `src/pages/auth` |
| 10 | tests/e2e | 24 | 12 | `tests/e2e` |

These ten are ~56% of kept events. Depth-1 (`src` vs `tests`) is too coarse; the real hands-on surface is **client logging**, **trainer authoring**, and **schema/RLS tests**.

## TOP 10 files

All still present in HEAD (checked 13 Aug 2026).

| # | File | Events | First → last touch |
| --- | --- | --- | --- |
| 1 | `src/components/guided-workout/GuidedWorkoutHub.tsx` | 14 | 14 Jun – 2 Aug |
| 2 | `src/lib/workout-sessions/service.ts` | 12 | 10 Jun – 2 Aug |
| 3 | `src/types.ts` | 12 | 28 May – 2 Jul |
| 4 | `src/pages/trainer/clients/[clientId]/sessions/[sessionId].astro` | 10 | 10 Jun – 3 Aug |
| 5 | `src/components/guided-workout/SetLogRow.tsx` | 10 | 14 Jun – 2 Aug |
| 6 | `src/components/plans/ClientPlanHub.tsx` | 9 | 10 Jun – 3 Aug |
| 7 | `src/components/guided-workout/SessionEditList.tsx` | 9 | 14 Jun – 2 Aug |
| 8 | `src/components/guided-workout/SessionOverview.tsx` | 9 | 14 Jun – 2 Aug |
| 9 | `src/components/Topbar.astro` | 9 | 21 May – 2 Aug |
| 10 | `src/components/plans/PlanCalendar.tsx` | 8 | 10 Jun – 3 Aug |

10th place is an 8-touch tie. Also at 8: `InviteClientPanel.tsx`, `SessionActualsReview.tsx`, `GuidedExerciseView.tsx`, `ClientCalendarHub.tsx`, `TemplateForm.tsx`, `pages/dashboard.astro`, `set-logs/service.ts`.

## Couplings (same-commit directories)

79 of 125 kept-file commits span 2+ directories. Counts below **exclude commits with ≥10 directories**.

### TOP pairs

| # | Directory A | Directory B | Together | Jaccard |
| --- | --- | --- | --- | --- |
| 1 | `src/components/guided-workout` | `src/lib/guided-workout` | 9 | 0.40 |
| 2 | `src/lib/workout-sessions` | `supabase/migrations` | 8 | 0.22 |
| 3 | `src/types.ts` | `supabase/migrations` | 8 | 0.31 |
| 4 | `src/components/workout-sessions` | `src/pages/trainer/clients` | 6 | 0.42 |
| 5 | `src/components/guided-workout` | `src/lib/set-logs` | 6 | 0.30 |
| 6 | `src/lib/guided-workout` | `src/lib/set-logs` | 6 | 0.50 |
| 7 | `src/components/session-comments` | `src/pages/trainer/clients` | 5 | 0.47 |
| 8 | `src/components/guided-workout` | `src/components/workout-sessions` | 5 | 0.19 |

Highest-Jaccard pair in the whole repo is **auth UI × auth pages (0.71)** — a tight vertical slice, outside the hotspot top 3.

### TOP triples

| # | Directories | Together |
| --- | --- | --- |
| 1 | guided-workout UI × guided-workout lib × `src/lib/set-logs` | 6 |
| 2 | session-comments × workout-sessions UI × trainer/clients pages | 4 |
| 3 | guided-workout UI × guided-workout lib × migrations | 4 |
| 4 | guided-workout lib × workout-sessions lib × migrations | 4 |
| 5 | set-logs × workout-sessions lib × migrations | 4 |

Typical commits for triple #1: optional RPE, prescription fill, 24h edit window, warmup inherit — logging UI, domain helpers, and set-log writes land together.

Source of these couplings: **git co-change**, not import graph. Artifact 2 should confirm or contradict with dependency-cruiser.

### Top 3 modules — how they actually move

| Module | UI × lib in same commit | Strongest partners | Read |
| --- | --- | --- | --- |
| guided-workout | **10 / 25** | set-logs, workout-sessions UI, client/trainer session pages, migrations | Only one of the three that behaves as a vertical slice. Hub UI + lib + set-logs are one unit. |
| session-templates | 5 / 16 | exercises + `pages/trainer/exercises`, trainer hub, workout-sessions | Authoring surface: moves with the exercise picker and trainer pages, **not** with client logging. |
| workout-sessions | **3 / 26 (weak)** | trainer/clients pages, guided-workout, migrations, session-comments | Two rhythms: `lib/` is schema-coupled; review UI (`SessionActualsReview`) is page-coupled. UI and lib often change in different commits. |

Folder names overstate unity for `workout-sessions`. Treat service vs review UI as separate change surfaces until artifact 2 says otherwise.

## Common denominator (cross-cutting file)

No i18n / locale / messages tree. No codegen dump. `src/lib/utils.ts` and `src/lib/supabase.ts` were each touched **once** (bootstrap).

| File | Partner areas | Multi-area commits (2–9 dirs) | In HEAD | What it is |
| --- | --- | --- | --- | --- |
| `package.json` | 30 | 14 | yes | Widest file in the repo — dependency/tooling noise, not a domain hub. Filtered from the ranking. |
| `src/types.ts` | 25 | 11 | yes | **The real shared denominator.** Recurring partner: `supabase/migrations` (8/11). Shared DTOs, ~185 lines — not translations. |
| `src/lib/workout-sessions/service.ts` | 25 | 11 | yes | Looks like a hub; it is a fat domain service, not a cross-cutting file. |
| `src/components/Topbar.astro` | 20 | 6 | yes | App chrome. Rides along with shell/layout work. |
| `src/lib/ui-classes.ts` / `src/styles/global.css` | 7 | 1–2 | yes | Shared styling; co-move only in redesign bursts, not as an ongoing hub. |

Schema change in this repo is typically **migration + `src/types.ts` (+ sometimes the fat session service)** in one commit. That is manual co-edit, not regeneration.

## Survival check (history vs HEAD)

All TOP 10 files, all TOP pair/triple directories, and the top-3 module folders **are still in HEAD** (verified 13 Aug 2026).

Of 290 kept historical paths, **270** are still present. The 20 gone paths are not the hotspot set — replacements and test-helper moves:

| Gone path | Historical touches | What happened |
| --- | --- | --- |
| `src/components/trainer/TrainerDashboardOverview.astro` | 4 | Replaced by `TrainerDashboardOverview.tsx` |
| `src/components/session-comments/SessionCommentsPanel.tsx` | 1 | Replaced by `SessionCommentsThread.tsx` — directory still coupled |
| `src/lib/guided-workout/prescription-fill.ts` | 1 | Logic now in `fill-from-prescription.ts` |
| `src/pages/api/sessions/[sessionId]/comments.ts` | 1 | Renamed param: `api/sessions/[id]/comments.ts` |
| `src/components/EmptyState.astro` | 1 | Renamed to `EmptyStateBlock.astro` |

Safe to base later analysis on the coupled directories and ranking files above. Do not cite the gone paths as current entry points.

## Implications for later artifacts

- Hottest change surface: **guided-workout + set-logs + session pages**. Start dependency-cruiser there, not at `src/`.
- `workout-sessions` is a name collision: confirm whether `components/` and `lib/` share a real import cycle or only a folder name.
- `src/types.ts` is the cross-cutting contract; `platform/types`-style isolation does not exist yet — expect many domains to import this one file.
- Auth is a clean vertical slice (high Jaccard, low volume). Useful contrast, not a hotspot.
- RLS integration tests and migrations are active enough to treat as first-class territory, not “just infra.”

## Limits

- Window is the whole repo life (~3 months), not a mature 12-month product.
- `--all` includes feature-branch commits that never landed on rewritten `main`.
- Co-change ≠ import coupling; wide token-redesign commits were cut but residual layout/chrome co-moves remain.
- Quarterly prompt was not executed; months are the available time grain.
- No contributor analysis here (that is artifact 3).
