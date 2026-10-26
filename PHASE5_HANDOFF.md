# ALTERA Phase 5 — Analytics Handoff (5.1 Foundation + 5.2 Advanced Insights)

## Delivered

- Added a lazy-loaded `/#/insights` page in the existing HashRouter application shell, with desktop and mobile navigation.
- Added a local-first analytics repository, pure metrics engine, range/time utilities, and a reactive Dexie hook. Analytics are derived from existing database records; no duplicate metrics are persisted, no server or AI API is involved, and no schema migration was added.
- Added Russian and English localizable analytics labels as lazy-loaded page namespaces. User-created project/task names remain unchanged and date/time formatting uses `Intl`.
- Built responsive, accessible visualizations for actual focus time, project time allocation, task statuses/priorities, activity by day/month, and project task summaries. The SVG charts include text alternatives; focus/activity data can be expanded as tables.
- Split React runtime modules into a `react-vendor` chunk with Vite 8/Rolldown code splitting so the app stays within the existing per-file initial bundle budget.
- Phase 5.2 extends Insights with equal-period comparisons, local custom date ranges, calendar planned-vs-session actual views, project deep dive, completion trends, deterministic observations, local CSV/JSON exports, and a compact Workspace summary.

## Files added

- `src/features/analytics/analytics.types.ts`
- `src/features/analytics/analytics.utils.ts`
- `src/features/analytics/analytics.repository.ts`
- `src/features/analytics/analytics.metrics.ts`
- `src/features/analytics/analytics.hooks.ts`
- `src/features/analytics/analytics.advanced.ts`
- `src/features/analytics/analytics.export.ts`
- `src/features/analytics/analytics.advanced.test.ts`
- `src/features/analytics/components/ComparisonPanel.tsx`
- `src/features/analytics/components/PlanActualPanel.tsx`
- `src/features/analytics/components/DeterministicInsightsPanel.tsx`
- `src/features/analytics/components/ProjectDeepDivePanel.tsx`
- `src/features/analytics/components/AnalyticsExportActions.tsx`
- `src/features/analytics/components/WeeklyAnalyticsSummary.tsx`
- `src/features/analytics/analytics.metrics.test.ts`
- `src/features/analytics/analytics.repository.test.ts`
- `src/features/analytics/components/AnalyticsPanel.tsx`
- `src/features/analytics/components/AnalyticsMetricCard.tsx`
- `src/features/analytics/components/FocusTimeChart.tsx`
- `src/features/analytics/components/ProjectFocusList.tsx`
- `src/features/analytics/components/ActivityHistory.tsx`
- `src/features/analytics/components/TaskOverview.tsx`
- `src/features/analytics/components/ProjectTaskTable.tsx`
- `src/features/analytics/components/ProjectActivityList.tsx`
- `src/pages/Insights.tsx`
- `src/i18n/insights.ru.json`
- `src/i18n/insights.en.json`

## Existing files updated

- `src/App.tsx` — lazy `/insights` route.
- `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx` — localized navigation/breadcrumb integration.
- `src/i18n/index.tsx` — typed lazy namespace loading; `src/i18n/ru.json`, `src/i18n/en.json` — navigation labels; `src/i18n/i18n.test.ts` — RU/EN namespace parity.
- `vite.config.ts` — Vite 8/Rolldown React runtime chunk group.
- `PROJECT_CONTEXT.md` — analytics architecture and current verification context.

No schema, services, Session Engine, Calendar logic, or persisted business records were changed by the analytics feature.

## APIs and data flow

- `getAnalyticsDateRange(key, now)` creates local `[start, endExclusive)` boundaries for `today`, `7d`, `30d`, `90d`, and `all`; `getCustomAnalyticsDateRange(startDate, inclusiveEndDate)` handles a user-selected local date range. `getPreviousAnalyticsDateRange(range)` creates the immediately preceding equal-length local-calendar window; all-time has no comparison.
- `getAnalyticsSourceData(range, database?, previousRange?)` queries the union of current/previous `sessions.startedAt` and `activities.createdAt` windows through existing indexes, reads current project/task records, and loads intersecting scheduled blocks separately. It does not load attachments.
- `calculateAnalyticsMetrics(source, range, selectedProjectId, now)` is a deterministic, side-effect-free derivation function for focus, sessions, task status/completion, project, and activity summaries.
- `analytics.advanced.ts` contains pure comparison, planned/actual, project timeline, as-of-range filtering, and insight-rule functions. `useAnalyticsMetrics(rangeKey, selectedProjectId?, customRange?)` connects these calculations to Dexie `useLiveQuery` and returns current/previous summaries, plan/actual metrics, comparison, project drill-down, and observations.
- The Dashboard weekly summary reuses the same pure focus-metric engine over its already-loaded recent project/session data; it does not perform a second analytics Dexie query.

## Metric definitions and assumptions

- **Focus time:** Uses `computeElapsedMs` from the existing Session Engine. Completed and unfinished duration are separated; an active session includes its current live interval and is labeled as unfinished. Planned calendar blocks are never included.
- **Overlap/integrity:** Invalid session timestamps/status/duration are excluded and counted. Intersecting session wall-clock intervals are all excluded rather than summed or guessed, preventing duplicate focus time. A visible warning reports excluded records.
- **Date allocation:** Sessions are selected and bucketed by their local start date. The data model stores accumulated active duration and `lastResumedAt`, but not a pause/resume interval history, so exact per-day allocation for a cross-midnight or paused session cannot be recovered. The UI discloses this instead of distributing estimated time. Running/paused records with a nonzero active duration still obey the existing engine calculation.
- **Completed tasks:** Current status totals use actual task status. Period completions use persisted `task_completed` activity events (including tasks later reopened/deleted) and `completedAt` only as a legacy fallback when no event exists for that task. The day/week trend applies the same de-duplication rule. Older records without either source are not assigned a fabricated date.
- **Overdue tasks:** Current `todo` and `in_progress` tasks with a due date strictly before local today are overdue. Completed/cancelled tasks are excluded.
- **Projects:** Active/completed/archived counts are current-state counts. Session snapshots for deleted projects remain grouped under their original project ID; unknown references stay distinct and display as unavailable. Project task summaries use current task references and never merge missing projects by name.
- **Activity:** Sessions count once, using the session record; duplicate `session_started`/`session_completed` activity rows are not counted again. Persisted non-session project/task events with meaningful timestamps count as activity; opening the app is not treated as productive work. “No activity” means no records of these measured types in the selected period, not that no work happened elsewhere.
- **Project last activity:** Completed sessions use `endedAt`, running sessions represent current activity, and paused sessions use their last recorded `lastResumedAt`. The exact pause instant is not available in the current model.
- **Time zone:** Boundaries and period keys use local calendar constructors; periods are start-inclusive and end-exclusive. DST day lengths are not assumed to be 24 hours.
- **Comparisons:** Focus, completed sessions, task completions, and planned time use the same selected range and preceding equal-length local-date interval. A 0→positive comparison shows the absolute change without a percentage; 0→0 is 0%. Session records updated after the previous interval ended are excluded from that historical comparison because persisted pause history cannot reconstruct the older state.
- **Planned vs actual:** Planned time is the clipped duration of non-cancelled Calendar blocks intersecting the selected range; actual time is validated Work Session duration assigned to the session's local start date. A past block still marked `planned` is reported as a status observation; it is not evidence that work did not happen. Matching by time overlap is never inferred. Project/time links are shown only when `scheduledBlockId` explicitly exists.
- **Project deep dive:** Combines range-valid focus sessions, current task statuses, persisted task/project activities, and scheduled block records. A calendar item in the timeline is the planned occurrence time, not an audit log of every schedule edit. Only existing projects link to `/projects/:id`; deleted-project session snapshots remain read-only historical summaries.
- **Deterministic observations:** `focus_change` requires an absolute change of at least 30 minutes; `project_inactivity` requires activity in the prior range and none in the selected range (archived projects excluded); `overdue_tasks` requires at least one currently overdue open task; `planning_gap` requires plan minus actual ≥1 hour and plan ≥1.5× actual; `project_concentration` requires at least 2 hours recorded, at least 2 projects in the filter context, and one project ≥60% of actual time. These thresholds produce neutral statements, not causal or psychological claims.
- **Export:** `buildAnalyticsReport` emits aggregate JSON and CSV locally. CSV cells are quoted, embedded quotes doubled, text fields beginning with spreadsheet formula characters are prefixed with an apostrophe, and UTF-8 BOM is added for Cyrillic compatibility. Reports contain selected filter/range, generation time, definitions, current/comparison totals, period and project breakdowns, and task-state counts; note text and attachment bytes are excluded.

## Routes, UI, and localization

- Route: `/insights` in the existing HashRouter, served as `/#/insights` locally.
- Existing shell/navigation and the charcoal/editorial tokens are preserved; no redesign of other pages was performed.
- Filters: Today, 7 days, 30 days, 90 days, All time, custom inclusive start/end dates, project selection, previous-period toggle, and reset. Selecting a focus-chart bar applies that date/month as a custom filter; project bars and plan/actual project rows synchronize the project filter.
- Planned/actual values use a paired muted-olive/warm-neutral bar chart with a data-table alternative and clickable project breakdown. Task completion history is shown by day for short ranges, week for longer bounded ranges, and month for all-time; current-state task status remains separately labeled.
- A compact current-week summary appears after the Workspace planning context and links to detailed Insights. The “Continue Working” hero remains unchanged.
- CSV/JSON buttons download in-browser with no upload or server dependency.
- All user-facing feature labels and chart/table text are translated in Russian and English. Dates, counts, and durations use locale-aware browser formatting.

## Tests and verification

- `npm test -- --reporter=dot`: **318 passed, 1 skipped** across 26 test files; the skip is the existing host-timezone-specific DST test.
- Analytics tests cover local range boundaries and DST-safe date arithmetic, paused/running/completed duration, midnight start-date convention, overlap exclusion, invalid/empty data, deleted project snapshots, date/project filtering, task status/completion timestamps, persisted activity de-duplication, indexed source queries, and Dexie live-query reactivity.
- `npx tsc -b --pretty false`: passed.
- `npm run lint`: passed with 12 warnings and no errors. Warnings remain in Knowledge Hub, i18n, note detail/editor, session dialogs, and attachment code; no analytics file reports a lint warning.
- `npm run build`: passed. Initial bundle results: JavaScript 600,109 B raw / 188,379 B gzip (largest chunk 218,740 B / 67,380 B gzip); CSS 86,762 B raw / 14,056 B gzip.
- `npm run check:bundle`: passed (JS budget 650,000 B / 210,000 B and largest JS chunk 400,000 B / 128,000 B; CSS budgets passed).
- Playwright MCP smoke: opened Insights on a fresh isolated local origin, verified real seeded data, switched 30-day to 7-day range, selected a project, changed RU to EN, then created and completed a work session via the existing UI and returned to verify completed-session count updated from 4 to 5. At 390px and 1440px, `document.documentElement.scrollWidth` matched `innerWidth`; the task table itself has an intentional contained horizontal scroller on narrow screens. Browser console ended with 0 errors and 0 warnings.
- No user browser profile or existing IndexedDB was opened/reset. The only session created during browser QA lives in the isolated `127.0.0.1:5187` test origin.

## Known limitations

- Exact daily time distribution for sessions that cross midnight or include pauses is unavailable until the session model records interval history; current analytics use the session start-day convention.
- Project and overdue task states are current-state data rather than historical status timelines. Task completion history is accurate only where `task_completed` events or `completedAt` values exist; missing historical dates remain unavailable.
- Bounded comparisons exclude session rows updated after the prior period ended because the stored session model cannot reconstruct earlier pause/resume state.
- Calendar blocks do not record whether work actually happened unless an explicit session link exists. Even an explicit link identifies the relation; it is not used to assert adherence or completion automatically.
- Activity data is bounded to work sessions and persisted project/task event records; it does not infer off-app work or app-open time.
- Vitest has no DOM environment, so component interactions are not covered by a persisted DOM integration-test suite. Browser checks below use Playwright MCP; no Playwright CI test suite was added.

## Phase 5.2 implementation and verification

- Added custom date filters, same-length previous-period comparison, planned-vs-actual metrics/chart, project drill-down, task completion by day/week/month, deterministic observations, local CSV/JSON export, and a current-week Workspace summary.
- Added `analytics.advanced.test.ts`; updated repository and core-metric tests to cover calendar source data, range comparisons, task completion events, and exports.
- The targeted analytics suite passed **26 tests in 3 files**; the complete suite now passes **330 tests across 27 files** (one existing timezone-specific test is skipped). Final lint, build, bundle, responsive browser, export download, and RU/EN results are recorded below.
- No schema migration, session engine rewrite, user-data mutation, commit, or push was made for Phase 5.2.

## Final verification record

- `npm test -- --reporter=dot`: **330 passed, 1 skipped** across 27 files.
- `npx tsc -b --pretty false`: passed.
- `npm run lint`: passed with 12 warnings in existing attachment, Knowledge Hub, note editor/detail, i18n, and session-dialog code; no warning is reported in the analytics implementation.
- `npm run build`: passed. Initial JavaScript: **600,295 B raw / 188,489 B gzip**; largest initial JavaScript chunk: **218,740 B / 67,380 B gzip**; initial CSS: **88,361 B / 14,325 B gzip**.
- `npm run check:bundle`: passed against the configured initial JS, largest-chunk, and CSS limits.
- `git diff --check`: passed; Git printed only existing line-ending conversion warnings for dirty files.
- Playwright MCP verified the Insights page at **390, 768, 1024, and 1440 px**, with no document-level horizontal overflow. Verified RU/EN labels, custom-date selection, comparison control, project filtering and project deep dive, focus-chart date selection, CSV and JSON browser downloads, and the Workspace weekly summary at desktop and 390 px.
- Browser console: **0 errors and 0 warnings**. Downloaded JSON parsed successfully and contained aggregate fields only; the export did not include note content or attachment data.
- Browser testing used the isolated `127.0.0.1:5189` origin with test-seeded IndexedDB; the user's existing browser profile and database were not opened or modified. No automated Playwright CI suite was added.
- A small RU/EN chart accessible-label punctuation issue found during browser inspection was corrected and included in the final build/tests.
