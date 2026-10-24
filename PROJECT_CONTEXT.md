# ALTERA — PROJECT_CONTEXT.md

> Last updated: Phase 2.4 — Code Audit & Production Stabilization
> Location: `C:\Users\Admin\Downloads\ALTERA`

---

## 1. Existing Architecture

### Tech Stack
| Layer | Technology |
|---|---|
| Bundler | Vite 8 + `@vitejs/plugin-react` |
| UI | React 19, TypeScript 6 (strict, `erasableSyntaxOnly`) |
| Styling | Tailwind CSS 3 — dark-first, CSS variable tokens |
| Components | Radix UI primitives (Dialog, DropdownMenu, Checkbox, Select, Tooltip…) |
| Icons | lucide-react |
| Routing | React Router v7 (`HashRouter`) |
| State | Zustand 5 (UI/filter state only — no server cache) |
| Persistence | Dexie.js v4 + IndexedDB |
| Reactive queries | `dexie-react-hooks` — `useLiveQuery` |
| Testing | Vitest 5, fake-indexeddb |
| Linting | oxlint |

### File Structure
```
src/
  __tests__/
    setup.ts                         fake-indexeddb auto-install
    sessions.test.ts                 session engine, timer, migration and concurrency tests
    database.test.ts                 database transaction and integrity tests
  components/
    layout/
      ActiveSessionBanner.tsx        NEW (Phase 2.3) — Global top bar across app showing live active session
      Header.tsx                     Breadcrumbs (Dashboard, Projects, My Tasks, Sessions, Settings) + search
      Layout.tsx                     Shell — sidebar + <ActiveSessionBanner> + <Outlet>
      Sidebar.tsx                    220px <-> 48px icon rail, project list, active session badge/pulse
    sessions/
      ActiveSessionPanel.tsx         Prominent live timer, running/paused status, pause/resume/end
      EndSessionDialog.tsx           Final duration, accomplishments, blockers, next step, Next Action sync
      SessionDetailDialog.tsx        Full session review, linked task resolution, inline edit summary, delete
      SessionHistory.tsx             History list, project/date/search filtering, empty states
      SessionStatsOverview.tsx       Today focus time, week focus time, completed count, active state
      StartSessionDialog.tsx         Project picker, focus task, title, objective, conflict guard
    shared/
      CreateProjectDialog.tsx
      EmptyState.tsx
      PriorityIcon.tsx
      ProgressBar.tsx
      ProjectCard.tsx                Enhanced (Phase 2.3) — last session relative time, accomplishment, Resume Work
      StatusBadge.tsx
      TaskRow.tsx                    Checkbox + inline edit + delete confirm dialog
    ui/                              shadcn-style Radix wrappers
      button, checkbox, dialog, dropdown-menu, input,
      select, separator, textarea, tooltip, badge
  db/
    db.ts                            AlteraDB (Dexie) — v1 + v2 schema, CRUD helpers
    seed.ts                          Demo seeder (7 projects, 40+ tasks, activities, 4 demo sessions)
    sessions.ts                      Session service & state machine (CRUD, queries, formatters)
  hooks/
    useActivity.ts                   useRecentActivity(limit, projectId?)
    useProjects.ts                   useProjects, useProject, useActiveProjects, useRecentlyVisitedProjects
    useSessions.ts                   Reactive hooks (useActiveSession, useProjectSessions, useLatestProjectSession,
                                     useProjectTotalDuration, useAllSessions, useLiveElapsedMs, useSessionActions)
    useTasks.ts                      useTask, useProjectTasks, useAllTasks, useActiveProjectTasks, useMyTasks, useProjectTaskStats
  pages/
    Dashboard.tsx                    Enhanced (Phase 2.3) — Focus Today counter, Continue Working cards with last
                                     accomplishment + Resume Work CTA, session activity feed integration
    MyTasks.tsx                      Tasks scoped to active projects only
    Projects.tsx                     Filterable list, create/edit/delete
    ProjectWorkspace.tsx             Enhanced (Phase 2.3) — "Continue where you left off" signature continuity,
                                     Sessions tab with project total focus & history, header session button
    Sessions.tsx                     Work Sessions overview, active panel & history
    Settings.tsx                     IndexedDB stats, demo reset, About (real versions)
  store/
    useAppStore.ts                   Zustand: sidebarCollapsed, projectFilter, searchQuery, isCreateProjectOpen
  types/
    index.ts                         All shared TypeScript types
  App.tsx                            Route-level lazy loading with React.Suspense
  main.tsx
```

---

## 2. Phase 2.1 — Sessions Engine (Foundation Summary)

- **Dexie v2 Schema**: safe version upgrade adding `sessions` table without wiping existing data.
  Index: `id, projectId, taskId, status, startedAt, updatedAt, createdAt`.
- **Pure Timestamp Derivation**: duration is stored as `accumulatedDurationMs` and `lastResumedAt`. Timer is never stored as an incrementing interval counter; it survives page refreshes, tab switching, and browser restarts.
- **State Machine**:
  `startSession() -> [running] <-> pauseSession() / resumeSession() <-> [paused] -> completeSession() -> [completed]`.
- **Single Active Session Rule**: enforced atomically — throws `SESSION_ALREADY_ACTIVE` if an unfinished session is running or paused.

---

## 3. Phase 2.2 — Sessions Interface & User Experience (Summary)

- Dedicated `#/sessions` route with overview statistics (Focus Today, Focus This Week, Completed Sessions, Active Session).
- `ActiveSessionPanel` with live second-by-second digital timer and Pause/Resume/End controls.
- `StartSessionDialog` with project picker, title, task selection, objective, and conflict warning.
- `EndSessionDialog` capturing final duration, outcome, accomplishments, blockers, and next step.
- `SessionHistory` with search, date range filters ("All", "Today", "This Week", "Month"), and project filter.
- `SessionDetailDialog` with view and edit summary modes.

---

## 4. Phase 2.3 — Deep Integration & Project Continuity (Implemented)

### 1. Dashboard Integration
- **Workspace Quick Stat Banner**: Added real-time **Focus Today** metric (`Timer` icon + formatted hours/minutes) calculated reactively from completed sessions today + live elapsed time.
- **Enhanced Continue Working Project Cards (`ProjectCard.tsx`)**:
  - Displays most recent session relative date (e.g. `12m ago`, `4h ago`).
  - Displays last recorded accomplishment summary paragraph derived from IndexedDB.
  - Displays current next action.
  - Prominent **"Resume Work"** button: launches `StartSessionDialog` with this project pre-selected or returns to the active session.
- **Recent Activity Feed**: Integrated `session_started` and `session_completed` activity entries with distinct color accents (green for completed sessions, blue for started sessions) without event duplication.

### 2. Global Active Session Indicator (`ActiveSessionBanner.tsx`)
- Persistent compact banner mounted at the top of the shell (`Layout.tsx`) between Header and content.
- Shows running/paused status pill with glowing ping animation, project icon, project ID, session title, live timer, quick pause/resume toggle button, and "Open" navigation button.
- Automatically hides when the user is already on `#/sessions` to avoid visual redundancy.

### 3. Project Workspace Integration (`ProjectWorkspace.tsx`)
- **Start / Resume Session Button**: Placed in project header alongside status and priority controls. Shows live timer badge when active on this project.
- **Signature "Continue where you left off" Section**:
  - Displayed prominently directly below the header and above the Next Action input.
  - Derived strictly from the latest completed session for this project (`useLatestProjectSession`).
  - Shows when the user last worked, accomplishment summary, blockers & friction encountered, and planned next step.
  - Never generates mock or hallucinated text.
  - If no prior session exists, shows a clean, unobtrusive empty state with a "Start First Session" CTA.
- **Dedicated Sessions Tab**:
  - Added third tab: `Sessions (${projectSessions.length})`.
  - Top summary metric cards: **Total Project Focus** (`useProjectTotalDuration`), **Total Sessions**, and **Last Worked**.
  - Active session banner card if a session is currently running for this project.
  - Complete list of project sessions with outcome badges, duration, date, and accomplishments/next-step excerpts.
  - Clicking any session opens `SessionDetailDialog`.

### 4. Next Action Synchronization (`EndSessionDialog.tsx`)
- Added explicit opt-in checkbox: `"Update project's Next Action with this step"`.
- Displays live preview of the project's current next action (`Current: "..."`).
- When finalizing a session with a next step entered, `completeSession()` atomically completes the session, updates the project, and writes both activity records in one IndexedDB transaction.

### 5. Task Integration & Graceful Deletion Handling (`SessionDetailDialog.tsx`)
- Sessions with a linked `taskId` query `useTask(session.taskId)`.
- If task exists: displays task title, priority, status badge, and a direct "View" button to jump to the project workspace.
- If task was deleted: gracefully displays `"Task deleted or unavailable"` without crashing or breaking the dialog.

---

## 5. Phase 2.4 — Audit & Stabilization (Implemented)

### Session engine reliability
- All lifecycle decisions are made after re-reading the record inside a Dexie read/write transaction.
- The single-unfinished-session invariant is checked in the same serialized transaction that inserts the session, preventing simultaneous starts from separate tabs.
- Parallel pause/resume/complete actions safely reject stale transitions; duplicate completion cannot create a duplicate activity event.
- Optional task references are validated for existence and project ownership on session start and metadata updates.
- Invalid timestamps and non-finite, negative, or implausibly large duration values are normalized. A single session is capped at one year to contain corrupt legacy data.
- Editing completed notes preserves duration and lifecycle fields; unfinished records are rejected by the completed-summary API.

### Database integrity
- Project and task create/update/delete helpers keep records, derived progress, and activity events in atomic transactions.
- Concurrent project creation serializes identifier allocation.
- Projects with an unfinished session cannot be deleted. Completed session history is retained if its project is later deleted and is displayed with missing-reference fallbacks.
- The explicit Settings **Wipe All Data** action clears sessions as well as projects, tasks, and activities.
- The v1 → v2 migration is tested with a representative pre-sessions project record and preserves it unchanged.

### UI corrections
- Session completion and optional project Next Action synchronization are a single operation, eliminating the previous partially-saved retry trap.
- The global banner and workspace controls contain stale cross-tab action errors instead of producing unhandled Promise rejections.
- The **View Active Session** control navigates to `#/sessions`.
- General and project histories list completed sessions only; the unfinished session is rendered once in its dedicated active panel.
- Project deletion failures are shown in the confirmation dialog.
- The live timer rerender remains local and never writes once-per-second ticks to IndexedDB.

---

## 6. Verification & Testing

- **Vitest (`npm test`)**: 72 tests across `sessions.test.ts` and `database.test.ts`. Coverage includes lifecycle transitions, deterministic timestamp math, multiple pauses, reload-compatible persistence, invalid persisted values, task relationships, transaction rollback, v1 migration, simultaneous starts and duplicate completion prevention.
- **Production build (`npm run build`)**: `tsc -b && vite build` passes and retains route-level chunk splitting.
- **Oxlint (`npm run lint`)**: exits successfully. Remaining warnings are documented below.
- **Browser workflow (local Vite app, 24 Oct 2026)**: actually executed start with a linked task, running timer, pause, reload while paused, duration preservation, resume, cross-route global banner, completion with notes/blockers/next step, Dashboard continuity and activity, Project Workspace history, and a second start through **Resume Work**. Browser console contained no application errors.

### Confirmed limitations / unresolved items
- Oxlint reports four React advisory warnings for modal form state initialization effects. They are not build failures, but should be removed in a focused component-state cleanup.
- Focus-by-day/week attribution uses the session start date and total accumulated duration. A session crossing midnight or a week boundary is not split because the schema does not retain individual running intervals.
- There is no automated DOM component suite; UI integration was verified in the browser while business rules are covered at the service/database level.
- This directory has no `.git` metadata, so repository history, recent commits, and a source diff could not be audited.

---

## 7. Commands Reference

```powershell
npm run dev        # Vite dev server -> http://localhost:5173 by default
npm run build      # tsc -b && vite build (zero errors expected)
npm test           # Vitest service/database suite
npm run lint       # oxlint
```
