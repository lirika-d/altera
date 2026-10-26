# ALTERA Phase 4 — Calendar & Daily Planner Handoff

## Phase 4.2 — Daily Planner, Drag & Drop, Work Sessions Integration

### Delivered

- Added a planner backlog for open tasks in active projects, grouped by overdue, due today, and unscheduled work, with project filtering, priority, and deadlines.
- Added accessible scheduling forms and drag/drop from backlog to Day/Week/Month views. Task drops create a one-hour block at a 15-minute snapped local time; moving blocks preserves duration; resize handles adjust end time while the edit form remains a non-drag alternative.
- Added local in-app reminders for upcoming planned blocks and overdue tasks, configurable for 5/10/15/30 minutes. Dismissals are kept locally. These are not OS notifications and do not run while the app is closed.
- Added additive Dexie v9 `sessions.scheduledBlockId` index. Starting focus from a project-linked block uses the existing session route and validates project/task ownership in the session transaction. Sessions remain after block deletion; the relationship is cleared.
- Added planned/actual time summaries and linked session history on calendar blocks, a compact Dashboard plan summary, project schedule/deadline sections, and schedule indicators/quick actions in task views.
- Extended current schema-v3 backup validation and read-only integrity checks for optional session/block links. No schema v1/v2 backup migration support was added per user direction.
- Updated RU/EN localization and project context documentation.

### Verification in this phase

- `npx tsc -b --pretty false`: passed.
- `npm test -- --run`: 23 test files passed; 299 passed, 1 skipped (timezone-specific DST case on the host timezone).
- Calendar test file rerun with the PowerShell process timezone set to `America/New_York`: all 9 tests passed, including DST handling.
- `npm run lint`: passed with 12 warnings and no errors. The warnings remain in pre-existing attachment, localization, session-dialog, Knowledge Hub, and note-editor code; none points to the calendar/planner implementation.
- `npm run build`: passed; TypeScript project build and Vite production bundle completed.
- Playwright local run: checked Calendar at 1440×900, 768×900, and 390×844. The document remains within each viewport; only the week time grid scrolls horizontally on narrow screens. Day/Week/Month and Russian/English views were exercised. A task was scheduled from a project task row and opened in the calendar form with project/task preselected, then canceled. “Start Focus” navigated to `/sessions` with the project/task/block intent and opened the prefilled session dialog; it was canceled, so no session was created. Native task drag/drop created a temporary block after fixing the copy/move mismatch. A block move preserved its duration (08:00–08:30 → 10:00–10:30), and a resize drag changed another test block from 08:30 to 08:45. Temporary blocks were deleted afterward. Project Overview rendered its schedule summary; Dashboard showed the expected empty state. Browser console after the server restart: 0 errors and 0 warnings.

### Remaining limits

- No recurrence, external calendar sync, explicit time-zone selection, or notifications while the app is closed.
- Browser QA did not start a work session; session-to-block validation and history preservation are covered by the database tests.
- Existing demo tasks/projects were used for QA; the temporary blocks created via form, drag, and resize were removed. No project/task/session records were created or deleted.

## Delivered

- Added additive Dexie schema v8 migration: `scheduledWorkBlocks` store and a `tasks.dueDate` index. Existing v7 project/task records remain intact.
- Added validated scheduled-block CRUD and indexed `[start, end)` range queries, including events that begin before the visible range and overlap it.
- Added a lazy-loaded `/calendar` page with Day, Week, and Month views. Week is the default. Task deadlines appear in the calendar and open through existing task routes.
- Added Russian and English UI strings, desktop/mobile navigation, project/task associations, event status, overlap layout, and local-time date/time editing.
- Kept calendar dates as `Date` instants. Local calendar arithmetic uses date constructors instead of fixed 24-hour additions; nonexistent spring-forward times are rejected. An ambiguous fall-back wall time entered in the form resolves to its first occurrence. Default block duration advances by one wall-clock hour, and editing other fields preserves the exact instants of an existing ambiguous-time block.
- Preserved calendar blocks when linked records are deleted: deleting a task clears its task reference; deleting a project clears project and task references. The block title, schedule, description, and status remain.
- Kept backup format at schemaVersion 3. New exports contain `scheduledWorkBlocks`; previous v3 backups without that optional table remain importable and replace the current calendar with an empty one. Import validation checks dates, durations, status, and linked records before its transaction.
- Extended read-only integrity diagnostics to report missing calendar references and invalid intervals.

## Verification performed

- `npm test -- --reporter=dot`: passed; 21 test files, 289 passed, 1 skipped. The skip is the DST-specific case when the host timezone is not `America/New_York`.
- `TZ=America/New_York npm test -- src/__tests__/calendar.test.ts --reporter=dot`: passed; all 7 calendar tests, including spring-forward and fall-back cases. (On Windows this was run by setting the process `TZ` environment variable in PowerShell.)
- `npm run build`: passed (TypeScript project checks and Vite production build).
- `npm run lint`: passed with 12 existing warnings elsewhere in the workspace; no new warning points to the calendar files.
- Playwright: verified `/calendar` at 1280×720 and 390×844; created, edited, and deleted a temporary QA block; exercised Day/Week/Month and RU/EN. At 390px the document stayed within the viewport and only the calendar grid required horizontal scrolling. Browser console reported 0 errors and 0 warnings. The temporary block was removed after testing.

## Scope and remaining limitations

- This phase does not add recurrence, reminders, drag-and-drop, session-to-calendar conversion, external calendar sync, or time-zone selection.
- Calendar times use the browser's current local time zone. When a user changes a date/time field to an ambiguous fall-back wall time, the form chooses the first occurrence; there is no separate selector for the second occurrence.
- Backup v1/v2 are not supported; schemaVersion 3 remains the current format.
- No commit or push was made.

## Key files

Added in Phase 4.1: `src/types/calendar.ts`, `src/db/calendar.ts`, `src/hooks/useCalendarData.ts`, `src/lib/calendarDates.ts`, `src/lib/calendarLayout.ts`, `src/pages/Calendar.tsx`, `src/__tests__/calendar.test.ts`.

Added/integrated in Phase 4.2: `src/lib/planner.ts`, `src/lib/planner.test.ts`, `src/hooks/usePlannerTasks.ts`, `src/hooks/usePlannerReminders.ts`, `src/hooks/usePlannerReminders.test.ts`, `src/hooks/useProjectCalendar.ts`, `src/hooks/useTaskScheduleSummaries.ts`, `src/components/calendar/PlannerBacklog.tsx`, `src/components/calendar/PlannerReminderBanner.tsx`, `src/components/calendar/ProjectScheduleSection.tsx`, `src/__tests__/backupValidation.test.ts`, and `src/__tests__/integrity.test.ts`.

Integrated/updated: `src/db/db.ts`, `src/db/integrity.ts`, `src/db/backupValidation.ts`, `src/db/backupImport.ts`, `src/pages/Settings.tsx`, `src/App.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`, `src/i18n/en.json`, `src/i18n/ru.json`, `src/index.css`, `src/__tests__/integrity.test.ts`, `src/__tests__/backupValidation.test.ts`, and `PROJECT_CONTEXT.md`.
