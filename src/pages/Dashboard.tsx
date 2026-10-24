import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  ArrowRight,
  Target,
  Sparkles,
  Timer,
} from 'lucide-react'
import { useRecentlyVisitedProjects, useActiveProjects, useProjects } from '@/hooks/useProjects'
import { useMyTasks, useAllTasks } from '@/hooks/useTasks'
import { useRecentActivity } from '@/hooks/useActivity'
import { useAllSessions, formatDuration } from '@/hooks/useSessions'
import { useMinuteNow } from '@/hooks/useMinuteNow'
import { ProjectCard } from '@/components/shared/ProjectCard'
import { TaskRow } from '@/components/shared/TaskRow'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { StartSessionDialog } from '@/components/sessions/StartSessionDialog'
import { useAppStore } from '@/store/useAppStore'
import type { Project } from '@/types'

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function Dashboard() {
  const { setIsCreateProjectOpen } = useAppStore()
  const recentProjects = useRecentlyVisitedProjects(3) || []
  const activeProjects = useActiveProjects() || []
  const allProjects = useProjects() || []
  const allTasks = useAllTasks() || []
  const myTasks = useMyTasks(6) || []
  const activities = useRecentActivity(8) || []
  const allSessions = useAllSessions() || []
  const now = useMinuteNow()

  const [sessionTargetProject, setSessionTargetProject] = React.useState<Project | null>(null)

  // Compute Focus Time Today
  const todayStr = now.toDateString()
  const focusTodayMs = allSessions
    .filter((s) => s.status === 'completed' && new Date(s.startedAt).toDateString() === todayStr)
    .reduce((sum, s) => sum + s.accumulatedDurationMs, 0)

  // Fallback for "Continue Working" if lastVisitedAt is scarce
  const continueProjects =
    recentProjects.length > 0 ? recentProjects : activeProjects.slice(0, 3)

  const completedTasksCount = allTasks.filter((t) => t.status === 'done').length
  const totalTasksCount = allTasks.length
  const overallProgress =
    totalTasksCount === 0 ? 0 : Math.round((completedTasksCount / totalTasksCount) * 100)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Workspace Quick Stat Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-gradient-to-r from-bg-surface via-bg-surface to-bg-elevated shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-text-primary">
              ALTERA Workspace
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-blue/15 text-accent-blue border border-accent-blue/20">
              <Sparkles className="h-2.5 w-2.5" /> Local First
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Keep momentum going with crystal-clear next actions.
          </p>
        </div>

        {/* Mini stats counters */}
        <div className="flex items-center gap-6">
          <div className="text-left">
            <div className="text-[11px] text-text-muted">Focus Today</div>
            <div className="font-mono text-base font-semibold text-accent-blue flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              <span>{formatDuration(focusTodayMs)}</span>
            </div>
          </div>
          <div className="h-7 w-px bg-border-subtle" />
          <div className="text-left">
            <div className="text-[11px] text-text-muted">Total Projects</div>
            <div className="font-mono text-base font-semibold text-text-primary">
              {allProjects.length}
            </div>
          </div>
          <div className="h-7 w-px bg-border-subtle" />
          <div className="text-left">
            <div className="text-[11px] text-text-muted">Active</div>
            <div className="font-mono text-base font-semibold text-text-primary">
              {activeProjects.length}
            </div>
          </div>
          <div className="h-7 w-px bg-border-subtle" />
          <div className="text-left">
            <div className="text-[11px] text-text-muted">Tasks Complete</div>
            <div className="font-mono text-base font-semibold text-accent-green">
              {completedTasksCount}/{totalTasksCount}
              <span className="text-[10px] text-text-muted font-normal ml-1">
                ({overallProgress}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Continue Working */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent-blue" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Continue Working
            </h2>
          </div>
          <Link
            to="/projects"
            className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary transition-colors"
          >
            All projects <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {continueProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {continueProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onResumeWork={(p) => setSessionTargetProject(p)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create your first project to get started with instant local tracking."
            actionLabel="Create Project"
            onAction={() => setIsCreateProjectOpen(true)}
          />
        )}
      </div>

      {/* SECTION 2: Grid containing Active Projects, My Tasks, and Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Active Projects + My Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Projects Table */}
          <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-elevated/40">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-3.5 w-3.5 text-accent-blue" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Active Projects
                </h3>
                <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 bg-bg-base rounded border border-border-subtle">
                  {activeProjects.length}
                </span>
              </div>
              <Link
                to="/projects"
                className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                View all
              </Link>
            </div>

            {activeProjects.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {activeProjects.map((proj) => (
                  <Link
                    key={proj.id}
                    to={`/projects/${proj.id}`}
                    className="group flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-bg-elevated transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="text-sm shrink-0">{proj.icon || '📁'}</span>
                      <span className="font-mono text-[11px] font-semibold text-text-secondary shrink-0">
                        {proj.identifier}
                      </span>
                      <span className="font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                        {proj.name}
                      </span>
                    </div>

                    {/* Next Action preview */}
                    <div className="hidden sm:flex items-center gap-1.5 text-text-muted min-w-0 max-w-[200px] truncate">
                      <Target className="h-3 w-3 text-accent-blue shrink-0" />
                      <span className="truncate text-[11px]">
                        {proj.nextAction || 'No next action'}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-3 shrink-0">
                      <ProgressBar
                        progress={proj.progress}
                        showPercentage
                        size="sm"
                        className="w-24"
                      />
                      <StatusBadge status={proj.status} showLabel={false} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-text-muted">
                No active projects right now.
              </div>
            )}
          </div>

          {/* My Tasks Widget */}
          <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-elevated/40">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent-green" />
                <h3 className="text-xs font-semibold text-text-primary">
                  Top Priority Tasks
                </h3>
                <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 bg-bg-base rounded border border-border-subtle">
                  {myTasks.length}
                </span>
              </div>
              <Link
                to="/my-tasks"
                className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                View all tasks
              </Link>
            </div>

            {myTasks.length > 0 ? (
              <div className="p-2 space-y-1">
                {myTasks.map((task) => (
                  <TaskRow key={task.id} task={task} showProject={true} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-text-muted">
                All caught up! No pending tasks remaining.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 span): Recent Activity Feed */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border-subtle bg-bg-elevated/40">
              <h3 className="text-xs font-semibold text-text-primary">
                Recent Activity
              </h3>
            </div>

            {activities.length > 0 ? (
              <div className="p-3 divide-y divide-border-subtle">
                {activities.map((act) => {
                  const isSessionCompleted = act.type === 'session_completed'
                  const isSessionStarted = act.type === 'session_started'
                  const isComplete = act.type === 'task_completed'
                  const isNextAction = act.type === 'next_action_set'
                  const isCreated = act.type === 'project_created' || act.type === 'task_created'

                  return (
                    <div key={act.id} className="py-2.5 first:pt-1 last:pb-1">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                            isSessionCompleted || isComplete
                              ? 'bg-accent-green'
                              : isSessionStarted || isNextAction
                              ? 'bg-accent-blue'
                              : isCreated
                              ? 'bg-accent-purple'
                              : 'bg-text-muted'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-text-primary leading-tight">
                            {act.description}
                          </p>
                          <span className="text-[10px] text-text-muted font-mono mt-0.5 inline-block">
                            {formatTimeAgo(act.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-text-muted">
                No recorded activity yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Start Session Dialog when user clicks Resume Work */}
      <StartSessionDialog
        open={!!sessionTargetProject}
        onOpenChange={(open) => !open && setSessionTargetProject(null)}
        initialProjectId={sessionTargetProject?.id}
      />
    </div>
  )
}
