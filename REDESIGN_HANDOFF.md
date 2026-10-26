# ALTERA — Frontend Redesign Handoff

> Prepared 2026-10-26. This file is a technical map, not a visual specification. Phase 6 did not choose a new palette, font, layout, or external reference.

## Readiness

**READY WITH LIMITATIONS.** The application has page-level React route boundaries, shared layout/UI primitives, lazy page chunks, typed route helpers, a pure analytics calculation layer, and strong service-level tests. A presentation-only redesign can proceed without recreating application behavior if the contracts and protected areas below are respected. Automated Playwright E2E is not part of CI; browser journeys require a manual run for now.

## 1. User-facing routes

The app uses `HashRouter` in `src/App.tsx`; the URL fragment is the route. Root `/` is Workspace and can redirect to a saved default opening route. Unknown routes redirect to `/`.

| Route | Screen / intent |
|---|---|
| `#/` | Workspace / Dashboard |
| `#/projects` | Project list; query intent can open project-from-template flow |
| `#/projects/:id` | Project Workspace and its tabs/related records |
| `#/my-tasks` | Cross-project tasks; query intent can open task creation/template |
| `#/sessions` | Focus session and history; query intent can start a session |
| `#/calendar` | Day/week/month planner, work blocks, deadlines |
| `#/insights` | Analytics and reports |
| `#/knowledge/*` | Knowledge Hub tabs, selected notes/resources, create intents |
| `#/settings` | Language, Workspace preferences, templates, storage, backup, integrity, reset |

Keep query semantics in `src/lib/appRoutes.ts`. Examples include `task`, `session`, `block`, `action`, `template`, `note`, and `resource`. Prefer these helpers over handwritten URLs; direct-link and browser history behavior is covered by route tests.

## 2. Shared shell and layout

- `src/App.tsx`: `HashRouter`, lazy route loading, root/default route handling, global shortcut listener, lazy Command Palette, shortcut-help dialog. `src/components/shared/AppErrorBoundary.tsx` handles render errors and Vite stale-chunk failures separately; a stale chunk offers a localized, user-confirmed refresh and warns about unsaved edits.
- `src/components/layout/Layout.tsx`: application shell, Sidebar, Header, active-session banner, planner reminder, global project dialog, routed page outlet.
- `src/components/layout/Sidebar.tsx`: desktop navigation, favorites, focus status; hidden below Tailwind `md` breakpoint.
- `src/components/layout/Header.tsx`: compact mobile navigation, breadcrumbs, search, notifications, create menu.
- `src/components/calendar/PlannerReminderBanner.tsx`, `src/components/layout/ActiveSessionBanner.tsx`: persistent global status surfaces.
- Route pages are lazy loaded; keep route boundaries and suspense fallbacks intact when extracting presentational components.

## 3. Design tokens, typography and global CSS

- Global tokens and editor/calendar styles: `src/index.css`.
- Tailwind aliases and font stacks: `tailwind.config.js`.
- Font links and document defaults: `index.html`.
- Current CSS variables in `src/index.css`: base `#0e0e0d`, surface `#151513`, elevated `#1c1c19`, hover `#23231f`, border `#282823`, subtle border `#1e1e1a`, primary text `#f2f0ea`, secondary `#9c9a8e`, muted `#828075`, olive `#8a9e6b`, sage `#6c7f53`, dim sage `#3e4a2d`.
- Typeface intent: Inter for UI/body; Lora/Playfair Display serif for editorial headings and note content; JetBrains Mono for timers/IDs/numeric detail. Google Fonts are requested remotely from `index.html`; system/serif/monospace fallbacks exist, so offline typography may differ.
- Some views use token-backed Tailwind colors; others still contain literal hex colors. Settings' palette swatches and parts of older pages are not fully aligned with the current CSS variable values. Consolidate carefully only after visual references are approved.

## 4. Reusable UI primitives

`src/components/ui/` contains shared Radix-backed Dialog, Dropdown Menu, Checkbox, Select, Tooltip, plus Button, Input, Textarea, Badge, Separator, and the language switcher. Prefer these for keyboard/focus behavior and consistency. `src/components/shared/` contains domain-level shared cards, empty states, dialogs, artwork, and error/recovery boundaries. Do not replace primitives wholesale merely to change styling.

## 5. Responsive behavior

Tailwind uses its default breakpoints: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px. `Sidebar` is hidden below `md`; `Header` offers compact mobile navigation. Pages use a mixture of responsive grid/flex classes. Calendar's week/day grid may intentionally scroll horizontally inside its own container; this is different from document-level overflow. At 390×844, Phase 6 checked the Workspace and Settings document widths with no page overflow. Recheck every page after redesign at mobile and desktop sizes; a single Workspace smoke test is not sufficient coverage for all routes.

## 6. Localization

- Dictionaries: `src/i18n/ru.json` and `src/i18n/en.json`.
- Runtime/context and typed translation helper: `src/i18n/index.tsx`.
- RU/EN selection persists separately in `localStorage` (`altera_language`). Do not translate user-authored project, task, note, resource, or template content.
- Both RU/EN dictionaries and the supplemental `src/i18n/ui-text.ru.json` / `ui-text.en.json` cover the existing static interface copy. `npm run check:i18n` checks dictionary key/placeholder parity and source references for `t`/`tx`, visible JSX literals, and configured labels. Selected-language date formatting is used in the reviewed high-visibility routes/components. Preserve the translation keys and `tx` flow while redesigning; do not translate user-authored project, task, note, resource, or template data.
- The source-reference check is a guardrail, not proof that every conditional runtime state has been visually reviewed in both languages. Recheck every route, dialog, error, and empty state in RU and EN after redesign.

## 7. Data/model and protected boundaries

- `src/types/`: project/task/session/knowledge/calendar/template domain shapes.
- `src/db/db.ts`: Dexie `AlteraDB`, schema v10. v8 adds scheduled calendar blocks; v9 adds optional session→block link; v10 adds workflow templates. Migrations are additive and released migrations must not be rewritten.
- `src/db/*.ts`: authoritative IndexedDB services, transaction rules, import/export validation, deletion/detachment behavior, integrity checks, seeding.
- `src/components/knowledge/editor/`, `src/db/knowledge.ts`: editor and note persistence/revision/autosave behavior.
- `src/db/sessions.ts`, `src/hooks/useSessions.ts`: session state transitions and duration/timer behavior.
- `src/features/analytics/`: analytics repository and pure metrics/report logic. Keep planned time distinct from actual session time.
- `src/lib/appRoutes.ts`: typed route/action contracts used by search, shortcuts, and destination screens.
- `src/db/backupValidation.ts`, `src/db/backupImport.ts`, `src/db/backupPreferences.ts`: v3 backup shape validation and atomic IndexedDB restore, plus a narrowly scoped portable-settings payload. Schema version is 3 even though the Dexie schema is v10. Exports include app preferences and planner reminder lead time; language, dismissed reminders, recovery drafts, and temporary UI state stay device-local. Older v3 backups without `preferences` remain supported. Keep the 50 MiB import/export size contract and do not clear recovery drafts during import.
- `src/db/seed.ts`, `src/db/db.ts::clearAllData`: destructive operations. Reset/wipe behavior must stay consistent with its confirmation dialog, and tests must prove new tables/links are handled.

For a visual-only pass, do not change database types/schemas, migration code, data services, session timers/state machines, note save coordination, backup contracts, route semantics, keyboard intents, or analytics calculation semantics. If a JSX component mixes these concerns, keep the current handlers/hooks/data flow and move only display markup or classes.

## 8. Visual inconsistencies currently present

- Literal hex values coexist with CSS variables and Tailwind color aliases; same semantic surface can look slightly different between screens.
- Some view shells/cards use editorial serif headings, while older session/settings/tool surfaces retain denser, smaller SaaS-style typography and English copy.
- Font sizes, border radii, card density, page gutters, and heading scales vary between Dashboard, Calendar, Insights, Knowledge Hub, Settings, and older dialog surfaces.
- Settings includes a token swatch list that does not exactly mirror `src/index.css`; treat the stylesheet as the runtime source of truth until tokens are centralized.
- Calendar has a dense weekly time grid and contained horizontal scrolling; Knowledge Hub has a multi-column reading/editor structure that needs dedicated narrow-screen review.
- Dashboard composition, page headers, and cards combine utility classes with one-off color/spacing literals. They are redesign candidates, not evidence that product logic should be rewritten.

## 9. Components with presentation/logic coupling

- `src/pages/Dashboard.tsx`: queries recent project/session/task data, derives Workspace summaries, handles preference visibility/order, and renders the hero/cards.
- `src/pages/Calendar.tsx`: date/view state, queries, scheduling, drag/drop/resize, reminders, session startup, route intents, and calendar grid markup are close together. Protect the tested planner behavior.
- `src/pages/KnowledgeHub.tsx`: URL-driven note/resource selection, selection fallback, tab state, list/navigation, and editor composition.
- `src/pages/Projects.tsx` and `src/pages/MyTasks.tsx`: CRUD dialogs, route-based create intents, filtering, and page layout.
- `src/pages/Sessions.tsx` plus session dialogs: lifecycle actions, timer surfaces, filters/history, and UI state.
- `src/pages/Settings.tsx`: backup/reset/integrity actions and storage counters sit alongside settings presentation; new preference/template subcomponents are more separable.
- `src/components/search/CommandPalette.tsx`: search subscriptions, command filtering, typed routing, and command presentation. Keep it unsubscribed while closed.
- `src/pages/Insights.tsx`: filters and chart composition are page-level; the pure metrics/repository layer in `src/features/analytics/` is already a good boundary and should remain the calculation source.

### Minimal safe separation plan

1. Choose a page only after a concrete design reference is supplied.
2. Snapshot its route/data/query/keyboard contracts before editing.
3. Extract a presentational component only where props can fully describe the rendered state; keep services and mutations at the current page/hook boundary.
4. Replace visual classes/tokens without changing labels used as accessible names, query keys, IDs required by tests, or event order.
5. Add/update a screenshot or browser smoke check for the target viewport and run focused route/service tests plus the full quality gates.
6. Avoid a global design-system rewrite in the same patch as a page redesign.

## 10. Regression checks after redesign

Always run `npm test`, `npm run lint`, `npm run build`, `npm run check:bundle`, and `git diff --check`. Then manually exercise relevant browser journeys in an isolated browser origin:

- Sidebar/mobile navigation and root/default-route behavior.
- Project↔task navigation, create/edit/delete confirmations, and empty/loading states.
- Session start/pause/resume/finish and timer persistence across route/reload.
- Knowledge Hub note/resource deep links, editing, save indicator, browser back/forward, and reload persistence.
- Calendar view persistence, create/edit/delete, drag/resize, task/block links, and session-from-block.
- Insights filters, detail navigation, export privacy, and small-screen layout.
- Settings preferences/templates, reset confirmation, backup restore confirmation, and integrity report.
- Ctrl/Cmd+K, route sequences, `?` help, typing/IME suppression, palette selection, and dialog focus/escape behavior.
- RU/EN switching; check both new and older literal strings.
- Simulate a stale Vite lazy-chunk failure; verify the localized recovery screen, no automatic reload/reset, and confirmation warning before refresh.
- Keyboard-only controls, visible focus, dialog focus containment, labels, and reduced-motion behavior.
- At minimum 390×844, 768×900, 1024×900, and 1440×900; distinguish intentional inner scrollers from page overflow.

Current automated/browser verification details and known limitations: `PHASE6_HANDOFF.md`, `FINAL_PRODUCT_AUDIT.md`, and `PROJECT_CONTEXT.md`.

## 11. Final stabilization update — 26 October 2026

- Backup v3 now includes validated portable preferences and planner reminder timing; export is refused when its generated JSON exceeds the 50 MiB import limit. Import still validates the complete backup before the database transaction, preserves device-local language/reminder dismissals/recovery drafts, and reports a preference-restore failure separately. An isolated fake-IndexedDB round-trip test clears test tables, imports every backed-up table and settings, and compares contents/relationships; no real browser profile is used by that test.
- Note-document validation now bounds the count of queued child nodes before adding nested arrays to the traversal worklist. This avoids a wide-array allocation spike during validation. The 50 MiB synchronous file read/JSON parse is still capable of pausing low-memory browsers; image pixel-decode limits are not defined.
- Localization inventory adds static UI dictionary parity/source checks and translations for several configuration-generated status/priority/resource/attachment/session labels and empty fallbacks. The redesigned experience must preserve translation keys and user-authored content unchanged.
- Stale lazy-chunk handling was manually exercised on a dedicated local origin by dispatching Vite's `vite:preloadError` event. The event was prevented, the localized RU recovery screen appeared, and it offered a confirmation-gated refresh with an unsaved-edit warning. This verifies the listener/UI path, not behavior of a real CDN or a post-deployment 404 on a selected hosting provider.
- Additional Playwright smoke on that isolated origin: eight main routes loaded without alert or console errors; RU→EN→RU changed the actual Settings UI; a created note autosaved, survived reload, and was selected through Command Palette search; a session completed start→pause→resume→finish and appeared in history. Only this origin's IndexedDB was reset to its original demo fixture afterward; the unique smoke records and active session were confirmed absent. This does not cover every CRUD action, drag/drop flow, browser size, or host deployment behavior.
- Current checks on 26 October 2026: full test suite 32 files / 373 passed / 1 skipped; production build passed (2,180 modules); `npm run check:i18n` passed (2 tests); lint passed with 13 warnings; production dependency audit found 0 vulnerabilities; full audit reports 3 moderate advisories in the Tailwind 3/PostCSS development/build chain. `npm run check:bundle` currently fails its raw-JavaScript budget: 657,972 B vs 650,000 B, while gzip is 205,569 B vs 210,000 B. Do not hide this by merely raising the budget. No Tailwind 4 migration was performed.
- The user explicitly stopped Codex Security scanning. The older Standard run remains an unsealed partial draft (one validated P2; 226-file coverage not reconciled); a newer-snapshot run was stopped before source review. Neither is a completed repository-wide security audit.
- Focused source review found no validated P0/P1 security issue. A P2 data-integrity edge case remains: an open note/resource dialog can submit a project or tag ID deleted in another tab; validate references and update resource tags in one transaction before addressing it. Static host headers/CSP, Edge on this machine, screen-reader testing, and a full CRUD/browser matrix remain unverified.

The repository is suitable for a presentation-only redesign with these boundaries and retests, but this is not a claim of full production readiness. Preserve the data services, transaction semantics, note autosave/recovery, backup contract, route intents, session state/timers, and analytics calculations.
