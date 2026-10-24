# ALTERA

ALTERA is a local-first project, task, and focused work-session manager. It runs entirely in the browser and persists data in IndexedDB through Dexie; there is no backend or account requirement.

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

- Projects, tasks, activities, and sessions are stored in the browser database `AlteraDB`.
- Session duration is derived from persisted timestamps and accumulated elapsed time, not interval tick counts.
- Only one running or paused session is allowed at a time; the invariant is enforced transactionally.
- Completing a session does not complete its linked task.
- Settings contains explicit demo-reset and wipe actions. Wiping is destructive and clears all four tables.

See `PROJECT_CONTEXT.md` for architecture, schema, service contracts, verification details, and known limitations.
