# ALTERA — PROJECT_CONTEXT.md

> Last updated: Phase 6 — local Workspace preferences, workflow templates, keyboard navigation, and final stabilization
> Location: `C:\Users\Admin\Downloads\ALTERA`

---

## 1. Architecture Overview

### Tech Stack
| Layer | Technology |
|---|---|
| Bundler | Vite 8 + `@vitejs/plugin-react` |
| UI | React 19, TypeScript 6 (`strict` in app and Vite configs, `erasableSyntaxOnly`) |
| Styling | Tailwind CSS 3 — Stitch Editorial Dark palette (Charcoal, Warm Dark, Olive/Sage tokens) |
| Typography | Serif headings (`Lora`, `Playfair Display`), Sans-serif UI (`Inter`), Monospace (`JetBrains Mono`) |
| Components | Radix UI primitives (Dialog, DropdownMenu, Checkbox, Select, Tooltip, Separator, Popover…) |
| Localization | Native offline React context (`src/i18n`) with Russian/English selection (`localStorage`); UI string coverage is incomplete |
| Icons | lucide-react |
| Routing | React Router v7 (`HashRouter`) |
| State | Zustand 5 (UI/filter/transient state only — no server cache) |
| Persistence | Dexie.js 4.x (database schema v10) + IndexedDB |
| Reactive queries | `dexie-react-hooks` — `useLiveQuery` |
| Rich Text | Custom contenteditable editor with a ProseMirror-compatible document JSON model |
| Testing | Vitest 5, fake-indexeddb |
| Linting | oxlint |

### File Structure
```
src/
  __tests__/
    setup.ts                               fake-indexeddb auto-install
    sessions.test.ts                       session engine, timer, migration and concurrency tests (66 tests)
    database.test.ts                       database transaction, integrity, wipe, and backup/restore round-trip tests (7 tests)
    calendar.test.ts                       v7→v8 migration, calendar CRUD/range queries, deletion detach, overlap layout, local dates/DST
    knowledge.test.ts                      Dexie v7 schema/migrations, knowledge CRUD, tags, links, revisions, soft-delete (27 tests)
    recoveryDiagnostics.test.ts            safe initialization/render-failure report serialization (1 test)
    integrity.test.ts                      read-only scan for orphan references and relationship inconsistencies (2 tests)
  components/
    knowledge/
      attachments/
        AttachmentItem.tsx                 Attachment card with preview, download, delete, and MIME badges
        AttachmentManager.tsx              File drop zone, 10MB quota validation, storage estimate banner
        AttachmentPreviewDialog.tsx        In-browser preview for images, text, and code attachments
        attachments.test.ts                25 unit tests for attachment sizing, categorization, memory revocation
      editor/
        EditorToolbar.tsx                  Rich text formatting controls (headings, lists, code, tables)
        editorTypes.ts                     Editor document node types, JSON normalization and safe parsing
        NoteEditor.tsx                     Rich-text note editor with serialized autosave, revision sync, and draft recovery
        saveCoordinator.ts                 One-in-flight save pipeline with latest-snapshot coalescing and retryable failures
        draftRecovery.ts                    localStorage recovery records keyed by note id and base revision
        saveCoordinator.test.ts             Controlled-promise tests for ordering, coalescing, errors, and conflicts
        draftRecovery.test.ts                Recovery-storage tests
        TableEditor.tsx                    Table insert, row/column addition and deletion
        editor.test.ts                     Document normalization and serialization tests
      notes/
        CreateNoteDialog.tsx               Modal to initialize new note with title, tags, and project link
        NoteCard.tsx                       Card presentation with title, plainText preview, tags, favorite toggle
        NoteDetail.tsx                     Split pane / full view note reader & editor with backlinks
        noteUpdateCoordinator.ts             Serializes same-instance note writes with expected revisions
        noteUpdateCoordinator.test.ts         Controlled-write and isolated fake-IndexedDB revision tests
        NoteList.tsx                       Searchable, filterable note list with trash toggle and sort
        noteUtils.ts                       Word count, reading time, plain text extraction helpers
        notes.test.ts                      25 unit tests for note mutations, revisions, and filters
      project/
        DashboardKnowledgeWidget.tsx       Dashboard right-column widget with recent notes and resources
        ProjectKnowledgeTab.tsx            Workspace tab integrating project notes, resources, attachments, and links
        SessionKnowledgeLinks.tsx          Link knowledge notes/resources created during work sessions
        TaskKnowledgeLinks.tsx             Attach reference resources to specific tasks
        projectIntegration.test.ts         7 unit tests for project and session knowledge linking
      relationships/
        BacklinksPanel.tsx                 Bidirectional backlinks inspector for notes, resources, projects, tasks
        EntityLinker.tsx                   Interactive dialog to link any entity to notes, resources, projects
        entityResolver.ts                  Cross-entity resolver fetching titles, icons, and routes
        LinkedEntities.tsx                 Pill grid rendering linked entities with quick unlink
        relationships.test.ts              21 unit tests for bidirectional links and duplicate prevention
      resources/
        CreateResourceDialog.tsx           Modal for creating links, code snippets, or reference files
        EditResourceDialog.tsx             Modal for updating resource metadata and snippet code
        ResourceCard.tsx                   Resource card with copy-to-clipboard, safe URL launch, favorite toggle
        ResourceDetailDialog.tsx           Modal displaying full snippet with syntax highlighting and metadata
        ResourceDetailModal.tsx            Unified resource viewer dialog
        ResourceList.tsx                   Searchable, type-filtered resource grid
        resources.test.ts                  17 unit tests for URL security and snippet handling
        urlSecurity.ts                     XSS protocol guard rejecting javascript:, data:, and vbscript: URLs
      search/
        KnowledgeSearchBar.tsx             Hub-specific search input with type filter pills
      tags/
        TagBadge.tsx                       Colored tag pill with remove action and custom hex color
        tagColors.ts                       Curated palette for tag categorization
        TagManagerDialog.tsx               Tag creation, color selection, and usage count manager
        TagPicker.tsx                      Combobox picker for attaching tags to notes and resources
    layout/
      ActiveSessionBanner.tsx              Global top bar across app showing live active session
      Header.tsx                           Breadcrumbs, search trigger button (⌘K / /), quick actions
      Layout.tsx                           Shell — sidebar + <ActiveSessionBanner> + <Outlet>
      Sidebar.tsx                          Navigation rail (Dashboard, Projects, My Tasks, Sessions, Calendar, Knowledge Hub, Settings)
    search/
      CommandPalette.tsx                   Global Command Palette (Ctrl+K / ⌘K / /) with score-ranked results
      search.test.ts                       29 unit tests for scoring, fuzzy search, snippets, ranking
      searchUtils.ts                       Local deterministic multi-entity search scoring engine
      useSearch.ts                         Search hook connecting live queries across 5 entities
    sessions/
      ActiveSessionPanel.tsx               Live timer, running/paused status, pause/resume/end
      EndSessionDialog.tsx                 Final duration, accomplishments, blockers, next step sync
      SessionDetailDialog.tsx              Full session review, linked task resolution, edit summary
      SessionHistory.tsx                   History list, project/date/search filtering
      SessionStatsOverview.tsx             Today focus time, week focus time, completed count
      StartSessionDialog.tsx               Project picker, focus task, title, objective, conflict guard
    shared/
      CreateProjectDialog.tsx
      EmptyState.tsx
      PriorityIcon.tsx
      ProgressBar.tsx
      ProjectCard.tsx                      Last session relative time, accomplishment, Resume Work
      StatusBadge.tsx
      TaskRow.tsx                          Checkbox + inline edit + delete confirm dialog
    ui/                                    shadcn-style Radix wrappers
  db/
    db.ts                                  AlteraDB (Dexie.js 4.x; database schema v1–v8), CRUD, clearAllData
    calendar.ts                            Validated scheduled-work-block CRUD and indexed range queries
    knowledge.ts                           Knowledge service: notes, resources, attachments, tags, links
    integrity.ts                           Read-only cross-table integrity scan, including calendar block references
    seed.ts                                Demo seeder (7 projects, 40+ tasks, 4 sessions, notes, resources, tags, links)
    sessions.ts                            Session service & state machine (CRUD, queries, formatters)
  features/analytics/
    analytics.repository.ts                 Indexed source reads for projects/tasks and ranged sessions/activity
    analytics.metrics.ts                    Pure focus, task, project, and activity metric calculations
    analytics.hooks.ts                      Dexie reactive snapshot and minute-updated running-session metrics
    analytics.utils.ts                      Local date ranges, labels, duration formatting, safe project colors
    components/                             Accessible SVG charts, summaries, and project/task tables
  hooks/
    useActivity.ts                         useRecentActivity(limit, projectId?)
    useKnowledge.ts                        useNotes, useNote, useResources, useResource, useAttachment,
                                           useTags, useEntityTags, useEntityLinks, useKnowledgeCounts, useKnowledgeActions
    useMinuteNow.ts                        Tick clock for relative timestamps
    useCalendarData.ts                     Reactive range query for scheduled blocks and task due dates
    useProjects.ts                         useProjects, useProject, useActiveProjects, useRecentlyVisitedProjects
    useSessions.ts                         useActiveSession, useProjectSessions, useLatestProjectSession,
                                           useProjectTotalDuration, useAllSessions, useLiveElapsedMs, useSessionActions
    useTasks.ts                            useTask, useProjectTasks, useAllTasks, useActiveProjectTasks, useMyTasks
  lib/
    attachments.ts                         10MB validation, MIME categorization, safe Blob download, URL revocation
    calendarDates.ts                       Local calendar arithmetic, locale week starts, DST gap validation
    calendarLayout.ts                      Deterministic lane layout for overlapping events
    utils.ts                               Tailwind class merger (cn)
  pages/
    Dashboard.tsx                          Focus Today, Continue Working, Active Projects, My Tasks, Knowledge Widget
    Calendar.tsx                            Day, week, and month views; local-time block editor; task deadlines
    KnowledgeHub.tsx                       Master hub with Notes, Resources, Attachments, Tags, Project filters
    Insights.tsx                            Lazy-loaded local analytics dashboard
    MyTasks.tsx                            Tasks scoped to active projects only
    Projects.tsx                           Filterable project list, create/edit/delete
    ProjectWorkspace.tsx                   Workspace tabs: Tasks, Sessions, Knowledge, Overview & Activity
    Sessions.tsx                           Work Sessions overview, active panel & history
    Settings.tsx                           IndexedDB stats, read-only integrity scan, Workspace Backup & Restore (JSON + Blobs + calendar)
  store/
    useAppStore.ts                         Zustand: sidebarCollapsed, projectFilter, searchQuery, commandPaletteOpen
  types/
    index.ts                               Core application TypeScript interfaces
    calendar.ts                            Scheduled work block model and supported statuses
    knowledge.ts                           Knowledge Hub types (Note, Resource, Attachment, Tag, EntityLink, etc.)
  App.tsx                                  Route configuration with React.Suspense and global CommandPalette
  main.tsx
```

---

## 2. Phase 2 Retrospective — Sessions & Project Continuity

- **Dexie v2 Schema**: safe version upgrade adding `sessions` table without wiping existing data.
  Index: `id, projectId, taskId, status, startedAt, updatedAt, createdAt`.
- **Pure Timestamp Derivation**: duration is stored as `accumulatedDurationMs` and `lastResumedAt`. Timer is never stored as an incrementing interval counter; it survives page refreshes, tab switching, and browser restarts.
- **State Machine**:
  `startSession() -> [running] <-> pauseSession() / resumeSession() <-> [paused] -> completeSession() -> [completed]`.
- **Single Active Session Rule**: enforced atomically — throws `SESSION_ALREADY_ACTIVE` if an unfinished session is running or paused.
- **Deep Workspace Continuity**: "Continue where you left off" signature banner, Next Action two-way sync, and dedicated Sessions tab on project workspaces.

---

## 3. Phase 3 — Knowledge Hub Architecture & Engine

### 3.1 Dexie v3 Schema
Dexie version 3 adds 6 dedicated stores for knowledge management while preserving existing v1 and v2 records:

```typescript
this.version(3).stores({
  projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
  tasks: 'id, projectId, status, priority, order, createdAt, updatedAt',
  activities: 'id, projectId, taskId, type, createdAt',
  sessions: 'id, projectId, taskId, status, startedAt, updatedAt, createdAt',
  notes: 'id, isFavorite, deletedAt, updatedAt, createdAt, revision',
  resources: 'id, type, isFavorite, deletedAt, updatedAt, createdAt',
  attachments: 'id, filename, mimeType, createdAt',
  tags: 'id, &name, normalizedName, createdAt',
  tagAssignments: 'id, tagId, entityType, entityId, [tagId+entityId], [entityId+tagId]',
  entityLinks: 'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceId+targetId]',
})
```

- **Compound Indexing**:
  - `tagAssignments`: `[tagId+entityId]` and `[entityId+tagId]` for instant tag filtering and reverse lookups.
  - `entityLinks`: `[sourceType+sourceId]`, `[targetType+targetId]`, `[sourceId+targetId]`, and the typed directed-edge key `[sourceType+sourceId+targetType+targetId]`.
- **Dexie v5/v6/v7 Integrity & Queries**: v5 adds the type-aware compound index and deduplicates only identical directed edges (retaining the earliest timestamp); v6 makes that key unique; v7 adds `projectId` indexes for notes/resources. `createEntityLink` checks both endpoints inside a read/write transaction spanning the entity tables and rejects duplicate directed edges. Different entity types may safely share the same raw IDs.
- **Optimistic Concurrency Control**:
  - Notes track a sequential integer `revision` property.
  - Concurrent writes verify `expectedRevision === currentRevision`. Mismatches throw `StaleWriteError` preventing data loss.
- **Soft-Delete with Trash Vault**:
  - Both `notes` and `resources` feature an optional `deletedAt?: Date`.
  - Soft-deleted items are excluded from active live queries and search by default, but can be viewed and restored from the Hub Trash view or permanently purged with cascade cleanup.

### 3.2 Knowledge Core Capabilities

#### 1. Notes Management & Rich Text Editor
- **WYSIWYG Engine**: Custom `contenteditable` UI backed by a ProseMirror-compatible JSON shape; it does not depend on the TipTap package. `document.execCommand` and manual range editing remain known editor-maintenance risks.
- **Dual Persistence**: Saves rich document structure in `contentJSON` (AST format) and searchable unformatted text in `plainText`.
- **Serialized Autosave**: A 600ms debounce stages editor snapshots; only one editor save runs at once, and edits during a write coalesce to the newest snapshot. Same-instance note writes (title, project, favorite, and content) share a serialized expected-revision coordinator.
- **Revision Safety**: The database-returned revision becomes the next expected revision. A stale write from another tab remains a conflict; it is never force-written over newer persisted content.
- **Draft Recovery**: Pending title, rich document JSON, and plain text are synchronously mirrored to a note-specific localStorage record, with sessionStorage fallback if localStorage is blocked or full. The editor clearly warns when recovery is tab-only or neither store is available and offers copy/download actions. Hidden-tab, blur, navigation, and unmount flushes are best effort; browser termination cannot guarantee IndexedDB completion. A matching-base draft can be restored; a stale-base draft can be copied or downloaded for manual merge.
- **Automatic Title Derivation**: Derives note title from the first document heading or first sentence if left untitled.
- **Reading Time & Word Count**: Real-time word count, character count, and estimated reading time calculation.

#### 2. Resources Library
- **3 Specialized Resource Types**:
  - `link`: Web URLs with protocol validation and external launch.
  - `snippet`: Multi-language code snippets with syntax highlighting, copy-to-clipboard, and line numbers.
  - `file`: Offline binary reference files backed by IndexedDB attachments.
- **URL Security**: Strict sanitization via `urlSecurity.ts` rejecting `javascript:`, `data:`, `vbscript:`, and malicious protocols before rendering or opening.

#### 3. Attachments & Blob Storage
- **Local Storage Engine**: Binary files stored as native browser `Blob` objects inside IndexedDB `attachments` table.
- **Size Quota Protection**: Strict enforcement of 10 MB per-file limit (`MAX_FILE_SIZE = 10 * 1024 * 1024`).
- **Memory Leak Prevention**: All Object URLs (`URL.createObjectURL`) are managed via `createSafeObjectURL` or `useObjectURL` with deterministic revocation callbacks (`URL.revokeObjectURL`) upon component unmount or dialog close.
- **In-Browser Previews**: Immediate preview modal for images (`image/*`), text files (`text/*`), Markdown, and source code (`.ts`, `.js`, `.py`, `.json`).

#### 4. Tags & Bidirectional Entity Relationships
- **Normalized Tagging**: Case-insensitive tag deduplication via `normalizedName`. Customizable color palette for visual grouping.
- **Universal Entity Links**: Any entity (`note`, `resource`, `project`, `task`, `session`) can be linked to any other entity.
- **Bidirectional Backlinks**: Automatic resolution of both outgoing and incoming edges. Viewing a note reveals all projects, sessions, or tasks pointing to it, and vice versa.
- **Self-Link & Duplicate Prevention**: Rejects missing endpoints and self-links, blocks duplicate typed directed edges transactionally, and enforces uniqueness in the v6+ schema.

#### 5. Global Search & Command Palette (`Ctrl+K` / `⌘K` / `/`)
- **Multi-Entity Indexing**: Scans across 5 entity types: Projects, Tasks, Sessions, Notes, and Resources.
- **Deterministic Relevance Scoring**:
  - Exact title match: 1000 pts
  - Exact identifier match: 900 pts
  - Prefix title match: 800 pts
  - Prefix identifier match: 750 pts
  - Word-prefix in title: 700 pts
  - Substring in title: 500 pts
  - Substring in secondary field: 300 pts
  - Content / description match: 100-150 pts
- **Keyword Match Snippets**: Highlights matched tokens with bold yellow-accented text segments and contextual surrounding text window.
- **Type Filtering**: Quick filter chips to narrow search to Projects, Tasks, Sessions, Notes, or Resources.

#### 6. Deep Cross-Entity Integration
- **Project Workspace Knowledge Tab**: Dedicated 3rd tab in `ProjectWorkspace.tsx` displaying all project-owned and linked notes, resources, and attachments with direct creation dialogs.
- **Dashboard Knowledge Widget**: Prominent widget in `Dashboard.tsx` displaying the 4 most recently updated knowledge items with direct navigation.
- **Session Continuity**: Work sessions link reference notes and documentation consults, preserved in session history.
- **Graph deletion policy**: Project deletion is transactional and blocked while its session is unfinished. Completed sessions retain a `projectSnapshot` (`id`, `name`, `identifier`) and lose the task link; notes/resources are detached without losing content, note revision advances, and project/task links and tag assignments are removed. Task deletion detaches sessions/activities and clears task tags/links. `SessionHistory` and session details display the deleted project's snapshot. Backup validation/import supports historical sessions without a live project and is covered by `graphCleanup.test.ts`.
- **Integrity diagnostics**: `inspectDatabaseIntegrity()` reads all relevant tables in one readonly transaction and reports orphan task/activity/session/project/note/resource/calendar-block/tag/link references, mismatched task ownership, invalid note revisions/intervals, and multiple unfinished sessions. It never edits records; automatic repairs are not included.

#### 7. Knowledge Hub Note Selection
- The `note` search parameter is the single source of truth for the selected note; selection is derived from the URL rather than duplicated in component state.
- `useNotesQuery()` preserves `undefined` while Dexie is loading. Knowledge Hub waits for loaded records before choosing a default, keeps valid URL selections, and replaces missing/deleted selections with a matching note or clears the stale parameter.
- Initial auto-selection replaces the URL entry. Explicitly clearing selection and browser Back/Forward navigation are preserved. Reactive hooks use shared empty values to avoid creating new fallback arrays or objects on each render.

#### 8. Command Palette Routing Contract
- Cross-page navigation intentions are centralized in `src/lib/appRoutes.ts`; routes are React Router paths and are resolved within the app's `HashRouter`.
- Entity selection contracts: projects use `/projects/:projectId`; tasks use `/projects/:projectId?task=:taskId` (or `/my-tasks?task=:taskId` when project metadata is unavailable); sessions use `/sessions?session=:sessionId`; notes use `/knowledge?tab=notes&note=:noteId`; resources use `/knowledge?tab=resources&resource=:resourceId`.
- One-shot creation contracts: `/knowledge?tab=notes&action=create`, `/knowledge?tab=resources&action=create`, and `/sessions?action=start`. Destination pages consume the intent once and remove `action` with history replacement so refresh/back do not reopen the dialog. Knowledge Hub also accepts the legacy `create-note` and `create-resource` action values.
- Resource, task, and session selections resolve against reactive Dexie data and clear stale query IDs when the target no longer exists. Task intents clear list filters, switch to the task tab, and scroll/highlight the selected row. Note selection keeps the existing Knowledge Hub URL-selection policy. New Project remains an in-memory Zustand dialog intent because its dialog is mounted globally in the application layout.
- Command Palette search scoring and keyboard navigation are unchanged; quick actions no longer rely on page-local custom events being received after navigation.

## 9. Phase 4.1 — Calendar Foundation
- **Dexie v8** added the `scheduledWorkBlocks` store and a `tasks.dueDate` index. **Dexie v9** adds the optional session-to-block relationship index. Both upgrades are additive and preserve existing records; no schema reset or reseed is performed.
- **Calendar page** is lazy-loaded at `/calendar`, available in desktop and mobile navigation, localized in Russian and English, and offers Day, Week, and Month views. Week is the default; the time grid is internally horizontally scrollable on narrow screens.
- **Scheduled blocks** store a title, optional description, optional project/task references, start/end instants, status (`planned`, `completed`, `cancelled`), and timestamps. CRUD validates title, duration, status, and live project/task ownership in IndexedDB transactions. Date/time inputs use the browser's local time zone; nonexistent spring-forward times are rejected, while an ambiguous fall-back wall time resolves to its first occurrence.
- **Task deadlines** are shown in the calendar from indexed `dueDate` queries. Clicking a deadline opens the existing task route. Calendar blocks and deadlines are read reactively without changing the Session Engine.
- **Deletion policy**: deleting a task clears only its `taskId` from scheduled blocks; deleting a project clears both `projectId` and `taskId`. The user-authored block content and schedule are retained. The existing integrity scan reports dangling calendar references or invalid intervals without modifying data.
- **Backup compatibility**: backup schemaVersion remains 3. New exports include `scheduledWorkBlocks` and any optional session `scheduledBlockId`; date instants are rehydrated on import. A prior schema-v3 backup with no calendar table remains valid and imports with an empty calendar. Backup schema v1/v2 is not supported.
- **Phase 4.1 boundary**: Phase 4.1 shipped the calendar foundation only. Phase 4.2 additions and remaining scope are described below.

## 10. Phase 4.2 — Daily Planner & Work Session Integration
- **Planner backlog**: open tasks from active projects are grouped into overdue, due-today, and unscheduled lists. Project filtering, due dates, and priority are visible. Scheduling works from an accessible dialog button as well as drag/drop; no task or project records are fabricated.
- **Drag/drop and resizing**: dragging a backlog task into a day/week grid creates a one-hour planned block at a 15-minute snapped local time. Dragging a block moves it while preserving duration; Month view supports moving blocks between dates. The resize handle changes the planned end with a 15-minute minimum, while the edit dialog remains the keyboard-accessible alternative. DST-nonexistent wall times are rejected.
- **Session relationship**: Dexie v9 adds the optional `sessions.scheduledBlockId` index and field. Starting focus from a linked block passes the block through the existing session-start route and validates project/task ownership transactionally. Multiple historical sessions can be associated with one block. Deleting a block only removes this relationship; session history is retained. Deleting projects/tasks detaches their scheduled-block references while preserving block content.
- **Planned versus actual**: calendar summaries and block details compare planned duration with elapsed durations from linked sessions. Dashboard, task rows, My Tasks, and Project Workspace show compact schedule summaries and links back to the calendar.
- **Reminders**: reminders are local in-app banners based on the selected 5/10/15/30-minute lead time, with dismissals stored locally. They are not operating-system notifications and are not delivered while the app is closed.
- **Backup/integrity**: backup JSON remains schemaVersion 3; new exports include the existing optional `scheduledWorkBlocks` table and optional session block links. Current-format v3 import validation checks references. No v1/v2 migration support is added per user direction. Integrity diagnostics now check dangling session-to-calendar-block references.
- **Limits**: recurrence, external calendar synchronization, notifications while the app is closed, and explicit time-zone selection remain out of scope. Calendar times use the browser's local zone.

---

## 4. Workspace Backup & Restore Specifications

ALTERA provides a complete local workspace export and import system in `Settings.tsx`:

### Export Format
Exports all 11 local database tables into a single portable, human-readable JSON file:
```json
{
  "app": "ALTERA",
  "schemaVersion": 3,
  "exportedAt": "2026-10-25T14:00:00.000Z",
  "tables": {
    "projects": [...],
    "tasks": [...],
    "activities": [...],
    "sessions": [...],
    "notes": [...],
    "resources": [...],
    "attachments": [...],
    "tags": [...],
    "tagAssignments": [...],
    "entityLinks": [...],
    "scheduledWorkBlocks": [...]
  }
}
```

### Binary Blob Handling
- **Export**: Attachments stored as Blobs are converted to standard Base64 Data URLs (`data:<mimeType>;base64,...`) via `FileReader` / `arrayBuffer` during serialization.
- **Import**: Serialized Data URLs are parsed and decoded back into binary `Blob` instances with their original MIME types and sizes before persisting into IndexedDB.

### Integrity & Safety Controls
1. **Runtime Validation**: Validates required fields, enum values, date formats, row limits, unique identifiers/tag/link keys, referential integrity (including scheduled block project/task links), session invariants, attachment MIME and decoded byte length before any existing data is cleared.
2. **File Guard**: Rejects backup files above 50 MB before reading them into memory.
3. **Date and Blob Rehydration**: Revives ISO date strings and reconstructs binary `Blob` attachments from validated data URLs.
4. **Atomic Transaction**: Restore operations execute inside one Dexie read/write transaction; any failed write rolls back the complete import.
5. **Destructive Action Confirmation**: Presents an explicit confirmation dialog detailing imported record counts before replacing existing data. Backup payload format remains schemaVersion 3; older v1/v2 formats are not supported. Calendar blocks are an optional field only to retain compatibility with earlier schema-v3 exports.

---

## 5. Reactive Hooks Architecture

| Hook | Parameters | Returns | Description |
|---|---|---|---|
| `useNotes` | `NoteFilterOptions?` | `Note[]` | Reactive list of active or trashed notes with project, tag, favorite, and search filters |
| `useNotesQuery` | `NoteFilterOptions?` | `Note[] \| undefined` | Reactive note query that preserves `undefined` until the first result loads |
| `useNote` | `id?: string` | `Note \| undefined` | Single note reactive query |
| `useTrashNotes` | — | `Note[]` | Reactive query for notes marked with `deletedAt` |
| `useResources` | `ResourceFilterOptions?` | `Resource[]` | Reactive list of resources filtered by type, project, tag, favorite, and search |
| `useResource` | `id?: string` | `Resource \| undefined` | Single resource reactive query |
| `useTrashResources`| — | `Resource[]` | Reactive query for resources marked with `deletedAt` |
| `useAttachment` | `id?: string` | `Attachment \| undefined`| Reactive query for single binary attachment |
| `useTags` | — | `Tag[]` | Alphabetical list of all available tags |
| `useEntityTags` | `entityType, entityId?` | `Tag[]` | Reactive list of tags assigned to a specific entity |
| `useEntityLinks` | `entityType, entityId?` | `EntityLinksResult` | Returns `{ outgoing, incoming, all }` links for an entity |
| `useKnowledgeCounts`| `projectId?` | `KnowledgeCounts` | Aggregate counts: `{ notes, resources, trash, favorites }` |
| `useKnowledgeActions`| — | `KnowledgeActions` | Bound CRUD action handlers with unified `isLoading` and `error` state |
| `useSearch` | `options` | `SearchResults` | Multi-entity search querying projects, tasks, sessions, notes, and resources |

---

## 6. Verification & Quality Assurance

- **Vitest (`npm test`)**: the Phase 4.2 baseline passed 304 tests across 24 files, with 1 timezone-specific DST test skipped on this host timezone. Latest Phase 5.1 results are recorded below.
- **Settings integrity scan**: invokes `inspectDatabaseIntegrity()` in a read-only transaction, localizes status and issue rows in Russian/English, and never repairs or changes records automatically.
  1. `src/__tests__/sessions.test.ts` (66 tests) — session lifecycle, timers, concurrency, reload-safe duration
  2. `src/components/search/search.test.ts` (29 tests) — multi-entity ranking, token prefix scoring, snippet extraction
  3. `src/__tests__/knowledge.test.ts` (27 tests) — Dexie v7 schema/migration, knowledge CRUD, soft delete, revision checks
  4. `src/pages/knowledgeHubSelection.test.ts` (8 tests) — loading gate, URL selection policy, empty/missing/deleted notes, and preservation of unrelated search parameters
  5. `src/components/knowledge/notes/notes.test.ts` (25 tests) — note lifecycle, autosave, title derivation, tag assignment
  6. `src/components/knowledge/attachments/attachments.test.ts` (25 tests) — 10MB limits, MIME deduction, Object URL revocation
  7. `src/components/knowledge/relationships/relationships.test.ts` (24 tests) — entity validation, typed duplicate rejection, bidirectional graph, backlinks
  8. `src/components/knowledge/resources/resources.test.ts` (17 tests) — safe URL verification, XSS protocol rejection, snippets
  9. `src/__tests__/database.test.ts` (7 tests) — atomic transactions, wipe, project deletion guard, JSON backup/restore round-trip
  10. `src/components/knowledge/project/projectIntegration.test.ts` (7 tests) — workspace tab, session/task knowledge linking
  11. `src/components/knowledge/editor/editor.test.ts` (1 test) — custom editor document normalization
  12. `src/components/knowledge/editor/saveCoordinator.test.ts` (6 tests) — serialized writes, coalescing, latest revision, retry, conflict, and editor-instance isolation
  13. `src/components/knowledge/editor/draftRecovery.test.ts` (5 tests) — local/session recovery fallback, storage failure, removal, and malformed data
  14. `src/components/knowledge/notes/noteUpdateCoordinator.test.ts` (7 tests) — metadata/content ordering, delayed writes, retry, stale conflicts, and isolated Dexie integration
  15. `src/lib/appRoutes.test.ts` (3 tests) — canonical entity-selection and creation-intent URL contracts, parameter encoding, and legacy Knowledge Hub action parsing
  16. `src/__tests__/backupValidation.test.ts` (12 tests) — backup validation, referential checks, typed edge identity, and safe IndexedDB import
  17. `src/__tests__/initialization.test.ts` (4 tests) — seed-on-first-run and empty-workspace persistence
  18. `src/__tests__/graphCleanup.test.ts` (4 tests) — transactional project/task/session cleanup, retained project snapshots, attached-file preservation, rollback, and backup import round-trip
  19. `src/__tests__/integrity.test.ts` (2 tests) — valid historical snapshots, orphan detection, and no-mutation guarantee
  20. `src/components/shared/recoveryDiagnostics.test.ts` (1 test) — safe, user-data-free failure report
- **Phase 4.2 calendar coverage**: `src/__tests__/calendar.test.ts` checks the additive v7→v9 migration, session/block validation, multiple linked sessions, and link detachment; `src/lib/planner.test.ts` covers planner grouping, duration totals, drop snapping/effects, and date parsing; `src/hooks/usePlannerReminders.test.ts` covers local reminder behavior.
- **Phase 4.2 Playwright check**: Calendar and project/task scheduling integrations were exercised at 1440×900, 768×900, and 390×844. Native task drag/drop was tested after aligning browser `dropEffect` with the source (`copy` for tasks, `move` for blocks). Native block movement preserved duration (08:00–08:30 → 10:00–10:30), and resize changed a temporary block from 08:30 to 08:45. “Start Focus” opened the prefilled session dialog from a block link; cancel returned to `/sessions` without creating a session. Existing project/task records were not changed; temporary calendar blocks were removed. Calendar views and RU/EN rendering were checked. Dashboard empty state and Project Workspace schedule section rendered. Final browser console check had zero errors and warnings.
- **Playwright smoke check**: Knowledge Hub note/resource selection, project/task/session search results, and browser Back/Forward restoration were checked in the isolated browser profile. Create Note, Add Resource, Start Session, and New Project commands opened their existing creation dialogs; each dialog was canceled without creating records. Direct `action=start` opened once and cleaned the query. Missing resource/task/session IDs were cleared without errors. Existing autosave checks confirmed body/title changes survive reload; blocked-storage recovery behavior was checked earlier. Fresh browser console check reported zero errors and zero warnings.
- **Component-test limitation**: Vitest has no DOM environment configured. Editor coordination is covered by deterministic coordinator tests and isolated fake IndexedDB service tests; actual typing and reload were checked in Playwright.
- **TypeScript & Production Build**: `npx tsc -b --pretty false` and `npm run build` passed. Latest build transformed 2,139 modules; Calendar is a lazy chunk (34.38 kB raw / 9.50 kB gzip).
- **Lint (`npm run lint`)**: passed with 12 warnings and no errors. Warnings are in existing note editor/detail, Knowledge Hub, i18n, attachment, and session-dialog code; none points to calendar/planner files.
- **Local-First Runtime**: Application data and services run client-side with no app backend or external telemetry. Google Fonts in `index.html` remain a network dependency for font loading; system fallbacks are available when offline.

## Phase 4 audit follow-up and Phase 5 foundation — 2026-10-26

- Task rows can set/change/clear `dueDate` through an accessible localized date dialog. The date is persisted with `updateTask` at local noon to avoid midnight DST transitions.
- Month-grid deadline buttons open the related task route. Session creation from a calendar block is allowed only while the block remains `planned`; this is checked transactionally by `startSession`.
- Backup timestamp validation now rejects impossible ISO calendar dates before import.
- `useTranslation().t()` accepts only translation keys derived from `ru.json`; tests require matching RU/EN keys and interpolation placeholders. Some user-facing strings elsewhere remain literal and are not yet covered by complete localization.
- `npm run check:bundle` checks initial production JS/CSS raw and gzip sizes, and runs in CI after build. Current budget baseline is 650,000 B raw / 210,000 B gzip for initial JS and 110,000 B raw / 20,000 B gzip for initial CSS.
- Latest measured initial bundle: JS 598,566 B raw / 188,461 B gzip; CSS 83,517 B raw / 13,568 B gzip.
- Remaining Phase 5 work: self-host Google Fonts and add automated Playwright E2E to CI. The local npm registry request timed out and `@playwright/test` is not installed; browser smoke tests were run through Playwright MCP in an origin-isolated profile instead.
- Calendar still uses a 24-hour fixed grid; on fall-back DST days, two instances of the same local hour can overlap. The date/time form chooses the first repeated hour.

### Phase 5.1 — Analytics & Insights

- Added a lazy-loaded `/insights` route, desktop/mobile navigation labels, and RU/EN page-localization dictionaries. No database schema or business services were changed.
- Analytics code lives in `src/features/analytics/`: `analytics.repository.ts` reads existing projects/tasks and indexed session/activity ranges; `analytics.metrics.ts` is a pure calculation layer; `analytics.hooks.ts` connects Dexie `useLiveQuery` to a minute-updated clock; `analytics.utils.ts` owns local date ranges, formatting, and safe project colors.
- Metrics are derived from real records and are not persisted. Focus totals use the existing `computeElapsedMs` rule, separate unfinished from completed sessions, reject invalid records, and exclude all records in overlapping session intervals to avoid inflated time. Calendar plans are not treated as actual focus.
- Session inclusion and chart buckets use each session’s local start date because pause/resume history by interval is not stored. Completed project activity uses `endedAt`; a running session is current activity; a paused session falls back to its last recorded `lastResumedAt` because the model has no pause timestamp.
- The task snapshot reflects current task state; period completions are counted only from `completedAt`. Existing completed tasks without that timestamp remain in current totals but are called out and excluded from period completion counts. Active-project counts/statuses are current state, not historical snapshots.
- Deleted-project session snapshots are kept separate by project ID; unknown projects are shown as unavailable rather than merged. Current task data for deleted projects likewise remains grouped by its original ID.
- Local range boundaries are `[start, endExclusive)`, use calendar-day arithmetic, and respect the browser time zone/DST. All time groups by month. The existing schema v9 has no session pause history, so exact distribution across paused days is unavailable; custom date ranges are not included in 5.1.
- The dashboard has accessible responsive SVG focus-time and task-status visualizations, project focus bars, activity history, task status/priority summaries, and a project task table. Focus and activity chart details can also be opened as data tables.
- Vite/Rolldown now isolates React runtime modules in `react-vendor` to keep the initial entry chunk under the existing per-chunk budget. This is build configuration only; it adds no runtime dependency.
- Phase 5.1 verification: full Vitest passed 318 tests across 26 files (1 existing timezone-specific DST test skipped). Production TypeScript/build and bundle check passed; initial JS was 600,109 B raw / 188,379 B gzip, CSS 86,762 B raw / 14,056 B gzip. Playwright MCP verified `/insights`, date and project filters, English/Russian rendering, creation/completion of a test session in the isolated local origin, live metrics update, and 390px/1440px viewport overflow. The app's real IndexedDB was not accessed. Details: `PHASE5_HANDOFF.md`.
- The Vitest setup has no DOM environment, so page interaction is covered by Playwright smoke verification rather than a persisted component-test harness. No automated Playwright E2E suite was added in this phase.
- Phase 5.2 builds on this foundation with advanced comparisons, calendar planning metrics, project drill-down, historical task completion events, deterministic observations, local report exports, and Workspace summary. See `PHASE5_HANDOFF.md` for definitions, verification, and limitations.

### Phase 5.2 — Advanced Insights, Planning Analytics & Reports

- `src/features/analytics/analytics.advanced.ts` is the pure calculation layer for equal-length local-period comparisons, planned-vs-actual summaries, project timeline records, historical source cutoffs, and explainable insight rules. `analytics.export.ts` serializes filtered aggregate reports as JSON/CSV.
- Repository source data now includes `scheduledWorkBlocks` as a separate plan source and reads the union of current/previous ranges through existing IndexedDB indexes. Work Sessions remain the only actual-time source; date overlap never links a session to a scheduled block. Existing `scheduledBlockId` is displayed only as an explicit relationship.
- Custom ranges are inclusive local start/end dates represented internally as `[start, endExclusive)`. Previous comparisons shift by the same number of local calendar days. A zero baseline has no percentage (except 0→0), and session rows changed after the old interval are excluded because historical pause state cannot be reconstructed.
- Task completion events use persisted `task_completed` activities, including tasks later reopened, with `completedAt` as a de-duplicated legacy fallback. Missing timestamps are not fabricated. Task status, overdue counts, and project statuses still describe the present state.
- Project deep dive combines range-valid sessions, current task state, saved project/task activity, and scheduled block occurrence records. Calendar items are not an edit log. Workspace summary uses the same metrics engine on Dashboard's loaded recent session/project data and adds no duplicate Dexie query.
- Deterministic insight thresholds: focus delta ≥30 minutes; inactivity means activity in the prior period and none in current (excluding archived); overdue count >0; plan gap ≥1 hour and planned ≥1.5× actual; project concentration ≥60% after at least 2 hours and at least two projects in the current filter context. No AI, causal claims, or productivity score.
- JSON/CSV exports include generation date, filter/range, definitions, summary/comparison values, period/project breakdown, and task-state aggregates. CSV includes quoted cells, formula-injection neutralization for text, and UTF-8 BOM. Note bodies and attachment blobs are excluded; downloads never upload data.
- Tests: `analytics.advanced.test.ts` covers calendar/local period comparison, zero baselines, clipping and separation of plan/actual, explicit relationships, historical cutoff, deterministic insight thresholds, and report safety. Core metric and repository tests also cover completion-event trends and indexed union queries. Phase 5.2 final verification: 330 passed, one existing timezone-specific test skipped, across 27 files; see `PHASE5_HANDOFF.md`.
- Remaining limitations: no pause interval history, no task status-event history beyond existing completion events, no actual adherence proof for unlinked blocks, no DOM test environment/Playwright CI suite, and current project/task states cannot be reconstructed historically. Only existing projects navigate to Project Workspace from analytics.

---

### Phase 6 — Personalization, Workflow Templates & Stabilization

- **Workspace preferences:** `src/lib/appPreferences.ts`, `src/types/preferences.ts`, and `src/hooks/useAppPreferences.ts` store a versioned `altera:preferences:v1` record in `localStorage`. This is separate from work data. Settings controls the opening route, default Calendar view, optional Workspace summary visibility/order, and reset. The main project card stays visible. The root route uses the configured start page; Calendar reads the saved Day/Week/Month view.
- **Workflow templates:** Dexie v10 adds only the `workflowTemplates` table; older migration declarations were not edited. `src/db/templates.ts` validates template input and delegates new project/task creation to existing services. A project plus its initial todo tasks is one transaction; templates do not copy historical sessions, notes, attachments, or links. `clearAllData()` and the explicitly confirmed demo-data reset include the new table.
- **Backup compatibility:** JSON remains schema v3. New exports include `scheduledWorkBlocks` and `workflowTemplates`; both are optional when validating/importing older v3 backups. Import validates before the replacement transaction. Preferences remain outside backup data.
- **Navigation and shortcuts:** `src/lib/appRoutes.ts` is the typed route contract for project/task/session selection, Knowledge Hub note/resource selection, create intents, Calendar, and session-from-block intents. `CommandPaletteLoader` in `src/App.tsx` owns one cleaned-up global listener; `src/lib/keyboardShortcuts.ts` contains the shortcut resolver. Implemented shortcuts are Ctrl/Cmd+K, `/` for search, Ctrl/Cmd+Shift+Enter for Create Task (avoids the browser's Ctrl+Shift+N private-window shortcut), G then W/P/C/I, and `?` for help. The modal and palette are localized. New route intents are handled by destination pages instead of relying on events dispatched before navigation.
- **Reset integrity repair:** the confirmed “Reset to Demo Data” action previously cleared projects/tasks but did not clear newly introduced scheduled blocks or templates. It now clears both stores in the same transaction before reseeding; the confirmation describes the reset scope in RU/EN. Regression coverage is in `src/__tests__/initialization.test.ts`.
- **Phase 6 regression coverage:** `src/lib/appPreferences.test.ts`, `src/db/templates.test.ts`, `src/lib/keyboardShortcuts.test.ts`, `src/lib/appRoutes.test.ts`, `src/__tests__/backupValidation.test.ts`, and `src/__tests__/initialization.test.ts`, plus the current-version assertion in `src/__tests__/calendar.test.ts`.
- **Browser verification:** Playwright MCP at `http://127.0.0.1:4175` (isolated origin/profile) covered navigation through Workspace, Projects, Tasks, Sessions, Knowledge Hub, Calendar, Insights, and Settings; project/task creation from templates; session start/pause/resume/finish; note save and reload; Calendar block creation, task link, and reload; Insights metrics; preference order/hide/reload and default route/calendar view; RU/EN; Ctrl/Cmd+K, `?`, G→W and palette navigation; and JSON export. Browser console: 0 errors / 0 warnings. No user browser origin or pre-existing IndexedDB was opened. Temporary QA records remain only in that isolated origin.
- **Current verification:** full test suite, TypeScript/build, lint, bundle budget, and exact final counts/results are recorded in `PHASE6_HANDOFF.md`. Lint has 12 existing warnings; automated Playwright E2E is not part of CI, so browser journeys were executed manually through the available Playwright browser tool.
- **Redesign readiness:** `REDESIGN_HANDOFF.md` documents routes, shell, tokens/fonts, responsive behavior, coupled areas, protected persistence/logic boundaries, and post-redesign regression checks. Status: READY WITH LIMITATIONS — a presentation-only redesign can proceed, but preserve route/service contracts and rerun the manual browser checks; broader existing RU/EN gaps and the lack of Playwright CI remain.

## 7. Commands Reference

```powershell
npm run dev        # Vite dev server -> http://localhost:5173 by default
npm run build      # tsc -b && vite build (zero errors expected)
npm test           # Vitest suite (latest Phase 6 result: see PHASE6_HANDOFF.md)
npm run lint       # oxlint
```
