import * as React from 'react'
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
import type { Session, Project } from '@/types'

export function Sessions() {
  const activeSession = useActiveSession()
  const allProjects = useProjects() || []

  const [isStartOpen, setIsStartOpen] = React.useState(false)
  const [isEndOpen, setIsEndOpen] = React.useState(false)
  const [selectedSession, setSelectedSession] = React.useState<
    (Session & { project?: Project; taskTitle?: string }) | null
  >(null)

  const activeProject = activeSession
    ? allProjects.find((p) => p.id === activeSession.projectId)
    : undefined

  const activeSessionWithProject = activeSession
    ? { ...activeSession, project: activeProject }
    : null

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-text-primary">
              Work Sessions
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-blue/15 text-accent-blue border border-accent-blue/20">
              <Sparkles className="h-2.5 w-2.5" /> Deep Work
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Timed personal sprints designed to eliminate context-switching and keep projects moving.
          </p>
        </div>

        {/* Global Start Session Action */}
        <Button
          onClick={() => setIsStartOpen(true)}
          size="sm"
          className="gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Session</span>
        </Button>
      </div>

      {/* 1. Real Statistics Overview */}
      <SessionStatsOverview />

      {/* 2. Prominent but compact Active Session Panel */}
      <ActiveSessionPanel
        onStartNew={() => setIsStartOpen(true)}
        onEndSession={() => setIsEndOpen(true)}
      />

      {/* 3. Session History List with Filtering */}
      <SessionHistory
        onSelectSession={(session) => setSelectedSession(session)}
        onStartNew={() => setIsStartOpen(true)}
      />

      {/* Modals */}
      <StartSessionDialog
        open={isStartOpen}
        onOpenChange={setIsStartOpen}
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
          if (!open) setSelectedSession(null)
        }}
      />
    </div>
  )
}
