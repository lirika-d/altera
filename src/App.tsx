import * as React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ensureDatabaseSeeded } from '@/db/seed'

// Route-level code splitting — each page chunk is fetched on first navigation
const Dashboard = React.lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard }))
)
const Projects = React.lazy(() =>
  import('@/pages/Projects').then((m) => ({ default: m.Projects }))
)
const ProjectWorkspace = React.lazy(() =>
  import('@/pages/ProjectWorkspace').then((m) => ({ default: m.ProjectWorkspace }))
)
const MyTasks = React.lazy(() =>
  import('@/pages/MyTasks').then((m) => ({ default: m.MyTasks }))
)
const Sessions = React.lazy(() =>
  import('@/pages/Sessions').then((m) => ({ default: m.Sessions }))
)
const Settings = React.lazy(() =>
  import('@/pages/Settings').then((m) => ({ default: m.Settings }))
)

/** Minimal in-layout fallback shown during route chunk fetch */
function RouteFallback() {
  return (
    <div className="flex-1 flex items-center justify-center h-full text-text-muted text-xs font-mono">
      Loading…
    </div>
  )
}

export function App() {
  const [isInitialized, setIsInitialized] = React.useState(false)

  React.useEffect(() => {
    ensureDatabaseSeeded()
      .then(() => setIsInitialized(true))
      .catch((err) => {
        console.error('Failed to initialize demo database:', err)
        setIsInitialized(true)
      })
  }, [])

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-base text-text-primary gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-tr from-accent-blue to-accent-purple text-white shadow-lg animate-pulse">
          <span className="font-bold text-sm">A</span>
        </div>
        <div className="text-xs font-mono text-text-muted">
          Initializing ALTERA local datastore...
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <Dashboard />
              </React.Suspense>
            }
          />
          <Route
            path="projects"
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <Projects />
              </React.Suspense>
            }
          />
          <Route
            path="projects/:id"
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <ProjectWorkspace />
              </React.Suspense>
            }
          />
          <Route
            path="my-tasks"
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <MyTasks />
              </React.Suspense>
            }
          />
          <Route
            path="sessions"
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <Sessions />
              </React.Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <Settings />
              </React.Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
