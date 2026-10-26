# ALTERA

ALTERA is a local-first project, task, focused work-session, and knowledge manager. It runs entirely in the browser and persists data in IndexedDB through Dexie; there is no backend or account requirement.

## Development

Requirements: a current Node.js release and npm.

```powershell
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173` by default. Application routes use a hash (`#/sessions`, `#/projects/:id`) so the production build works on static hosting.

## Verification

```powershell
npm test
npm run lint
npm run build
```

The test suite uses Vitest and `fake-indexeddb`. The production build runs TypeScript project checking before Vite bundling.

## Data and sessions

- Projects, tasks, activities, sessions, notes, resources, attachments, tags, tag assignments, and entity links are stored in the browser database `AlteraDB`.
- Scheduled calendar blocks and reusable workflow templates are also stored in `AlteraDB` (Dexie schema v10). Workspace preferences are separate, versioned browser `localStorage` data and do not contain project or note content.
- Session duration is derived from persisted timestamps and accumulated elapsed time, not interval tick counts.
- Only one running or paused session is allowed at a time; the invariant is enforced transactionally.
- Completing a session does not complete its linked task.
- Insights derives local reports from saved sessions, calendar blocks, tasks, and project activity. Planned and actual time remain separate; CSV/JSON exports are generated in the browser without uploading data.
- Settings contains explicit demo-reset and wipe actions. Reset replaces local records with demo data; wipe is destructive and clears all 13 database stores. Both operations are confirmed in the UI.
- JSON backup remains schema version 3. Calendar blocks and workflow templates are validated optional tables so older v3 backups continue to import; new exports include both.

See `PROJECT_CONTEXT.md` for architecture, schema, service contracts, verification details, and known limitations.
