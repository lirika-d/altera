import * as React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SessionStatsOverview } from '@/components/sessions/SessionStatsOverview'
import { ActiveSessionPanel } from '@/components/sessions/ActiveSessionPanel'
import { SessionHistory } from '@/components/sessions/SessionHistory'
import { StartSessionDialog } from '@/components/sessions/StartSessionDialog'
import { EndSessionDialog } from '@/components/sessions/EndSessionDialog'
import { SessionDetailDialog } from '@/components/sessions/SessionDetailDialog'
import { useActiveSession } from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useTranslation } from '@/i18n'
import type { Session, Project } from '@/types'

export function Sessions() {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSession = useActiveSession()
  const allProjects = useProjects() || []

  const [isStartOpen, setIsStartOpen] = React.useState(false)
  const [isEndOpen, setIsEndOpen] = React.useState(false)
  const [manuallySelectedSession, setManuallySelectedSession] = React.useState<
    (Session & { project?: Project; taskTitle?: string }) | null
  >(null)
  const actionHandledLocationRef = React.useRef<string | null>(null)
  const routeAction = searchParams.get('action')
  const routeProjectId = searchParams.get('project') || undefined
  const routeTaskId = searchParams.get('task') || undefined
  const routeBlockId = searchParams.get('block') || undefined
  const routeSessionId = searchParams.get('session') || undefined
  const routedSession = useLiveQuery(async () => {
    if (!routeSessionId) return null
    return (await db.sessions.get(routeSessionId)) ?? null
  }, [routeSessionId])

  // Consume route actions once. Replacing the URL keeps reloads and strict-mode
  // effect replay from opening another copy of the dialog.
  React.useEffect(() => {
    if (routeAction !== 'start' || actionHandledLocationRef.current === location.key) return
    actionHandledLocationRef.current = location.key
    setIsStartOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    setSearchParams(next, { replace: true })
  }, [location.key, routeAction, searchParams, setSearchParams])

  React.useEffect(() => {
    if (!routeSessionId || routedSession === undefined) return
    if (!routedSession || routedSession.id !== routeSessionId) {
      const next = new URLSearchParams(searchParams)
      next.delete('session')
      setSearchParams(next, { replace: true })
    }
  }, [routeSessionId, routedSession, searchParams, setSearchParams])

  const selectedSession = routeSessionId
    ? routedSession?.id === routeSessionId ? routedSession : null
    : manuallySelectedSession

  const activeProject = activeSession
    ? allProjects.find((p) => p.id === activeSession.projectId)
    : undefined

  const activeSessionWithProject = activeSession
    ? { ...activeSession, project: activeProject }
    : null

  const handleStartDialogChange = (open: boolean) => {
    setIsStartOpen(open)
    if (open) return
    if (!routeProjectId && !routeTaskId && !routeBlockId) return
    const next = new URLSearchParams(searchParams)
    next.delete('project')
    next.delete('task')
    next.delete('block')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="px-5 py-5 md:px-7 md:py-6 max-w-6xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#242420]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-2xl md:text-[28px] font-medium tracking-tight text-text-primary">
              {t('sessions.title')}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#8a9e6b]/15 text-[#8a9e6b] border border-[#8a9e6b]/25">
              <Sparkles className="h-2.5 w-2.5" /> {t('sessions.deepWork')}
            </span>
          </div>
          <p className="text-[13px] md:text-sm text-text-secondary mt-1 font-sans">
            {t('sessions.subtitle')}
          </p>
        </div>

        {/* Global Start Session Action */}
        <Button
          onClick={() => setIsStartOpen(true)}
          variant="olive"
          size="sm"
          className="gap-1.5 shadow-sm self-start sm:self-auto font-sans"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('sessions.newSession')}</span>
        </Button>
      </div>

      {/* 1. Statistics Overview */}
      <SessionStatsOverview />

      {/* 2. Active Session Panel */}
      <ActiveSessionPanel
        onStartNew={() => setIsStartOpen(true)}
        onEndSession={() => setIsEndOpen(true)}
      />

      {/* 3. Session History List with Filtering */}
      <SessionHistory
        onSelectSession={(session) => setManuallySelectedSession(session)}
        onStartNew={() => setIsStartOpen(true)}
      />

      {/* Modals */}
      <StartSessionDialog
        open={isStartOpen}
        onOpenChange={handleStartDialogChange}
        initialProjectId={routeProjectId}
        initialTaskId={routeTaskId}
        scheduledBlockId={routeBlockId}
      />

      <EndSessionDialog
        session={activeSessionWithProject}
        open={isEndOpen}
        onOpenChange={setIsEndOpen}
      />

      <SessionDetailDialog
        session={selectedSession}
        open={!!selectedSession}
        onOpenChange={(open) => {
          if (!open) {
            setManuallySelectedSession(null)
            if (routeSessionId) {
              const next = new URLSearchParams(searchParams)
              next.delete('session')
              setSearchParams(next, { replace: true })
            }
          }
        }}
        onDeleteSuccess={() => {
          if (!routeSessionId) return
          const next = new URLSearchParams(searchParams)
          next.delete('session')
          setSearchParams(next, { replace: true })
        }}
      />
    </div>
  )
}
