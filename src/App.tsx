import * as React from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ensureDatabaseSeeded } from '@/db/initialization'
import { RecoveryScreen } from '@/components/shared/AppErrorBoundary'
import { appRoutes } from '@/lib/appRoutes'
import { useAppPreferences } from '@/hooks/useAppPreferences'
import { isTextEntryElement, resolveGlobalShortcut, resolveGoSequence } from '@/lib/keyboardShortcuts'
import { KeyboardShortcutsDialog } from '@/components/shared/KeyboardShortcutsDialog'
import { useTranslation } from '@/i18n'

const LazyCommandPalette = React.lazy(() =>
  import('@/components/search/CommandPalette').then((module) => ({ default: module.CommandPalette }))
)

/** Load global search only after the user asks to open it. */
function CommandPaletteLoader() {
  const navigate = useNavigate()
  const [mounted, setMounted] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [showShortcuts, setShowShortcuts] = React.useState(false)
  const mountedRef = React.useRef(false)
  const pendingGoRef = React.useRef(false)
  const sequenceTimeoutRef = React.useRef<number | null>(null)

  const openPalette = React.useCallback(() => {
    mountedRef.current = true
    setMounted(true)
    setOpen(true)
  }, [])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const typing = isTextEntryElement(event.target)
      const target = event.target instanceof HTMLElement ? event.target : null
      const dialogOpen = Boolean(target?.closest('[role="dialog"]') || document.querySelector('[role="dialog"]'))
      const action = resolveGlobalShortcut(event, { isTyping: typing, isDialogOpen: dialogOpen })

      if (action === 'command-palette') {
        event.preventDefault()
        if (mountedRef.current) setOpen(current => !current)
        else openPalette()
        return
      }

      if (event.isComposing || event.keyCode === 229) return

      if (pendingGoRef.current) {
        pendingGoRef.current = false
        if (sequenceTimeoutRef.current !== null) window.clearTimeout(sequenceTimeoutRef.current)
        const destination = !typing && !dialogOpen ? resolveGoSequence(event.key) : null
        if (destination) {
          event.preventDefault()
          const targetPath = destination === 'workspace' ? '/' : `/${destination}`
          navigate(targetPath)
          return
        }
      }

      if (action === 'create-task') {
        event.preventDefault()
        navigate(appRoutes.createTask())
      } else if (action === 'shortcuts-help') {
        event.preventDefault()
        setShowShortcuts(true)
      } else if (action === 'sequence-g') {
        event.preventDefault()
        pendingGoRef.current = true
        sequenceTimeoutRef.current = window.setTimeout(() => { pendingGoRef.current = false }, 1500)
      } else if (event.key === '/' && !event.shiftKey && !typing && !dialogOpen) {
        event.preventDefault()
        if (mountedRef.current) setOpen(true)
        else openPalette()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('altera:open-command-palette', openPalette)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('altera:open-command-palette', openPalette)
      if (sequenceTimeoutRef.current !== null) window.clearTimeout(sequenceTimeoutRef.current)
    }
  }, [navigate, openPalette])

  return (
    <>
      {mounted && <React.Suspense fallback={null}>
        <LazyCommandPalette open={open} onOpenChange={setOpen} disableGlobalShortcuts />
      </React.Suspense>}
      <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
    </>
  )
}

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
const KnowledgeHub = React.lazy(() =>
  import('@/pages/KnowledgeHub').then((m) => ({ default: m.KnowledgeHub }))
)
const Settings = React.lazy(() =>
  import('@/pages/Settings').then((m) => ({ default: m.Settings }))
)
const Calendar = React.lazy(() =>
  import('@/pages/Calendar').then((m) => ({ default: m.Calendar }))
)
const Insights = React.lazy(() =>
  import('@/pages/Insights').then((m) => ({ default: m.Insights }))
)

/** Minimal in-layout fallback shown during route chunk fetch */
function RouteFallback() {
  const { tx } = useTranslation()
  return (
    <div className="flex-1 flex items-center justify-center h-full text-text-muted text-xs font-mono">
      {tx("Loading…")}</div>
  )
}

function WorkspaceEntryRoute() {
  const { defaultRoute } = useAppPreferences()
  const target = appRoutes.defaultRoutePath(defaultRoute)
  if (target) return <Navigate to={target} replace />
  return (
    <React.Suspense fallback={<RouteFallback />}>
      <Dashboard />
    </React.Suspense>
  )
}

export function App() {
  const { tx } = useTranslation()
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    let active = true
    ensureDatabaseSeeded()
      .then(() => { if (active) setStatus('ready') })
      .catch(() => {
        console.error({ scope: 'database', code: 'INITIALIZATION_FAILED' })
        if (active) setStatus('failed')
      })
    return () => { active = false }
  }, [attempt])

  if (status === 'failed') {
    return <RecoveryScreen code="DATABASE_INITIALIZATION_FAILED" onRetry={() => {
      setStatus('loading')
      setAttempt(value => value + 1)
    }} />
  }

  if (status === 'loading') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-base text-text-primary gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-[#273220] border border-accent-olive/40 text-accent-olive shadow-sm animate-pulse">
          <span className="font-serif font-bold text-base leading-none">A</span>
        </div>
        <div className="text-xs font-mono text-text-muted">
          {tx("Initializing ALTERA local datastore...")}</div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={<WorkspaceEntryRoute />}
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
            path="calendar"
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <Calendar />
              </React.Suspense>
            }
          />
          <Route
            path="insights"
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <Insights />
              </React.Suspense>
            }
          />
          <Route
            path="knowledge/*"
            element={
              <React.Suspense fallback={<RouteFallback />}>
                <KnowledgeHub />
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
      {/* Global Command Palette (Ctrl+K / Cmd+K), loaded on first invocation */}
      <CommandPaletteLoader />
    </HashRouter>
  )
}

export default App
