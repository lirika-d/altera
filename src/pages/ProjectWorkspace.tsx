import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Target,
  Plus,
  ArrowLeft,
  Trash2,
  Clock,
  Calendar,
  Check,
  Play,
  Pause,
  Timer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  History,
} from 'lucide-react'
import { useProject } from '@/hooks/useProjects'
import { useProjectTasks, useProjectTaskStats } from '@/hooks/useTasks'
import { useRecentActivity } from '@/hooks/useActivity'
import {
  useProjectSessions,
  useProjectTotalDuration,
  useLatestProjectSession,
  useActiveSession,
  useLiveElapsedMs,
  useSessionActions,
  formatDuration,
  formatTimer,
} from '@/hooks/useSessions'
import {
  updateProject,
  deleteProject,
  touchProject,
  createTask,
} from '@/db/db'
import { TaskRow } from '@/components/shared/TaskRow'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { EmptyState } from '@/components/shared/EmptyState'
import { StartSessionDialog } from '@/components/sessions/StartSessionDialog'
import { SessionDetailDialog } from '@/components/sessions/SessionDetailDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ProjectStatus, Priority, TaskStatus, Session } from '@/types'
import { cn } from '@/lib/utils'

function formatTimeAgo(date?: Date | string): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const project = useProject(id)
  const tasks = useProjectTasks(id) || []
  const stats = useProjectTaskStats(id) || {
    total: 0,
    done: 0,
    inProgress: 0,
    todo: 0,
    progress: 0,
  }
  const projectActivities = useRecentActivity(10, id) || []

  // Sessions queries & engine integration
  const projectSessions = useProjectSessions(id)
  const completedProjectSessions = projectSessions.filter(
    (session) => session.status === 'completed'
  )
  const latestSession = useLatestProjectSession(id)
  const projectTotalDuration = useProjectTotalDuration(id)
  const activeSession = useActiveSession()
  const activeSessionLiveMs = useLiveElapsedMs(activeSession)
  const { pause, resume, error: sessionActionError } = useSessionActions()

  const isActiveForThisProject = activeSession?.projectId === id

  const handleSessionToggle = async () => {
    if (!activeSession) return
    try {
      if (activeSession.status === 'running') {
        await pause(activeSession.id)
      } else {
        await resume(activeSession.id)
      }
    } catch {
      // useSessionActions keeps the error for inline display.
    }
  }

  // Active workspace tab: 'tasks' | 'overview' | 'sessions'
  const [activeTab, setActiveTab] = React.useState<'tasks' | 'overview' | 'sessions'>('tasks')

  // Next Action editable state
  const [nextActionValue, setNextActionValue] = React.useState('')
  const [nextActionSaved, setNextActionSaved] = React.useState(false)

  // Title & description inline states
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [titleValue, setTitleValue] = React.useState('')
  const [descValue, setDescValue] = React.useState('')
  const [descSaved, setDescSaved] = React.useState(false)

  // New task input state
  const [newTaskTitle, setNewTaskTitle] = React.useState('')
  const [newTaskPriority, setNewTaskPriority] = React.useState<Priority>('medium')
  const [taskFilter, setTaskFilter] = React.useState<'all' | TaskStatus>('all')

  // Dialogs
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isStartSessionOpen, setIsStartSessionOpen] = React.useState(false)
  const [selectedSessionForDetail, setSelectedSessionForDetail] = React.useState<Session | null>(null)

  // 1. Update lastVisitedAt on mount
  React.useEffect(() => {
    if (id) {
      touchProject(id)
    }
  }, [id])

  // Synchronize local edit values when switching projects
  const [syncedProjectId, setSyncedProjectId] = React.useState<string | undefined>(undefined)
  if (project && project.id !== syncedProjectId) {
    setSyncedProjectId(project.id)
    setNextActionValue(project.nextAction || '')
    setTitleValue(project.name)
    setDescValue(project.description || '')
  }

  if (!project && id) {
    return (
      <div className="p-12 max-w-xl mx-auto text-center space-y-4">
        <EmptyState
          title="Project not found"
          description="The requested project may have been deleted or the identifier is invalid."
          actionLabel="Back to Projects"
          onAction={() => navigate('/projects')}
        />
      </div>
    )
  }

  if (!project) return null

  // Save Next Action on blur or Enter
  const handleSaveNextAction = async () => {
    if (nextActionValue.trim() !== project.nextAction) {
      await updateProject(project.id, {
        nextAction: nextActionValue.trim(),
      })
      setNextActionSaved(true)
      setTimeout(() => setNextActionSaved(false), 2000)
    }
  }

  // Save Title
  const handleSaveTitle = async () => {
    setIsEditingTitle(false)
    if (titleValue.trim() && titleValue.trim() !== project.name) {
      await updateProject(project.id, {
        name: titleValue.trim(),
      })
    } else {
      setTitleValue(project.name)
    }
  }

  // Save Description on blur
  const handleSaveDescription = async () => {
    if (descValue.trim() !== project.description) {
      await updateProject(project.id, {
        description: descValue.trim(),
      })
      setDescSaved(true)
      setTimeout(() => setDescSaved(false), 2000)
    }
  }

  // Quick Add Task
  const handleCreateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newTaskTitle.trim()) return

    await createTask({
      projectId: project.id,
      title: newTaskTitle.trim(),
      status: 'todo',
      priority: newTaskPriority,
    })

    setNewTaskTitle('')
    setNewTaskPriority('medium')
  }

  // Delete Project
  const handleDeleteProject = async () => {
    setDeleteError(null)
    try {
      await deleteProject(project.id)
      navigate('/projects')
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete project')
    }
  }

  // Filter tasks
  const filteredTasks =
    taskFilter === 'all'
      ? tasks
      : tasks.filter((t) => t.status === taskFilter)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation Backlink */}
      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Projects</span>
        </Link>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-text-muted hover:text-accent-red hover:bg-accent-red/10 gap-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete Project</span>
        </Button>
      </div>

      {/* Project Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-5 rounded-xl border border-border bg-bg-surface shadow-sm">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded text-base bg-bg-base border border-border shrink-0 select-none"
              style={{ borderColor: `${project.color}40` }}
            >
              {project.icon || '⚡'}
            </span>
            <span className="font-mono text-xs font-semibold text-text-secondary tracking-wider">
              {project.identifier}
            </span>
          </div>

          {/* Inline Editable Title */}
          {isEditingTitle ? (
            <input
              autoFocus
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle()
                if (e.key === 'Escape') {
                  setTitleValue(project.name)
                  setIsEditingTitle(false)
                }
              }}
              className="text-xl font-bold bg-bg-base text-text-primary border border-accent-blue rounded px-2 py-0.5 w-full focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-xl font-bold text-text-primary hover:text-accent-blue cursor-pointer transition-colors"
              title="Click to rename"
            >
              {project.name}
            </h1>
          )}

          <p className="text-xs text-text-secondary line-clamp-2">
            {project.description || 'No description provided.'}
          </p>
        </div>

        {/* Project Meta Controls (Status & Priority) */}
        <div className="flex sm:flex-col items-center sm:items-end gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">Status:</span>
            <Select
              value={project.status}
              onValueChange={(val) =>
                updateProject(project.id, { status: val as ProjectStatus })
              }
            >
              <SelectTrigger className="w-32 h-7 text-xs bg-bg-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="backlog">Backlog</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">Priority:</span>
            <Select
              value={project.priority}
              onValueChange={(val) =>
                updateProject(project.id, { priority: val as Priority })
              }
            >
              <SelectTrigger className="w-28 h-7 text-xs bg-bg-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start / Resume Session Button */}
          <div className="pt-1">
            {isActiveForThisProject && activeSession ? (
              <Button
                size="sm"
                onClick={() => navigate('/sessions')}
                className="bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue border border-accent-blue/30 gap-1.5 shadow-sm text-xs h-7"
                title="View active session in Sessions"
              >
                <span className="relative flex h-2 w-2">
                  {activeSession.status === 'running' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-blue opacity-75" />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex rounded-full h-2 w-2',
                      activeSession.status === 'running' ? 'bg-accent-blue' : 'bg-accent-amber'
                    )}
                  />
                </span>
                <span className="font-mono font-bold">{formatTimer(activeSessionLiveMs)}</span>
                <span className="text-[10px] text-text-secondary capitalize">({activeSession.status})</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsStartSessionOpen(true)}
                className="gap-1.5 text-xs h-7 shadow-sm"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Start Session</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Signature "Continue where you left off" Continuity Section ── */}
      {latestSession ? (
        <div className="rounded-xl border border-border bg-gradient-to-br from-bg-surface via-bg-surface to-bg-elevated/60 p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-blue/15 text-accent-blue border border-accent-blue/25 shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-text-primary tracking-wide">
                  Continue where you left off
                </h3>
                <p className="text-[10px] text-text-muted">
                  Context derived from your last recorded session ({latestSession.title})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 rounded bg-bg-base border border-border-subtle">
                Worked {formatTimeAgo(latestSession.endedAt || latestSession.updatedAt)} • {formatDuration(latestSession.accumulatedDurationMs)}
              </span>
              <Button
                size="xs"
                onClick={() => {
                  if (activeSession) {
                    navigate('/sessions')
                  } else {
                    setIsStartSessionOpen(true)
                  }
                }}
                className="gap-1 text-xs h-6"
              >
                <Play className="h-2.5 w-2.5 fill-current" />
                <span>Resume Work</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
            {/* What you accomplished */}
            <div className="p-2.5 rounded-lg border border-border-subtle bg-bg-base/70 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-green flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Last Accomplished
              </span>
              <p className="text-xs text-text-primary line-clamp-3 leading-relaxed">
                {latestSession.accomplishments || (
                  <span className="text-text-muted italic">No specific accomplishment noted.</span>
                )}
              </p>
            </div>

            {/* Blockers */}
            <div className="p-2.5 rounded-lg border border-border-subtle bg-bg-base/70 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-amber flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Blockers & Friction
              </span>
              <p className="text-xs text-text-primary line-clamp-3 leading-relaxed">
                {latestSession.blockers ? (
                  latestSession.blockers
                ) : (
                  <span className="text-text-muted italic">None reported. Flow was smooth.</span>
                )}
              </p>
            </div>

            {/* Planned Next Step */}
            <div className="p-2.5 rounded-lg border border-accent-blue/20 bg-accent-blue/5 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-blue flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> Planned Next Step
              </span>
              <p className="text-xs text-text-primary font-medium line-clamp-3 leading-relaxed">
                {latestSession.nextStep || project.nextAction || (
                  <span className="text-text-muted italic font-normal">No next step specified.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Empty continuity state when no sessions have been recorded */
        <div className="rounded-xl border border-border-subtle bg-bg-surface/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-elevated border border-border text-text-muted shrink-0">
              <Timer className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary">
                No recorded work sessions yet
              </p>
              <p className="text-[11px] text-text-muted">
                Start a session to track focus time, log accomplishments, and seamlessly resume later.
              </p>
            </div>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setIsStartSessionOpen(true)}
            className="gap-1 text-xs shrink-0 self-start sm:self-auto"
          >
            <Play className="h-2.5 w-2.5 fill-current" />
            <span>Start First Session</span>
          </Button>
        </div>
      )}

      {/* PROMINENT "NEXT ACTION" FIELD */}
      <div className="relative p-4 rounded-xl border border-accent-blue/30 bg-gradient-to-r from-accent-blue/10 via-bg-surface to-bg-surface shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-blue text-white shadow-sm">
              <Target className="h-3 w-3 stroke-[2.5]" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-blue">
              Next Action
            </span>
            <span className="text-[10px] text-text-muted hidden sm:inline">
              (Auto-saves on blur)
            </span>
          </div>

          {nextActionSaved && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-accent-green animate-in fade-in">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>

        <div className="relative">
          <Input
            value={nextActionValue}
            onChange={(e) => setNextActionValue(e.target.value)}
            onBlur={handleSaveNextAction}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
            placeholder="What is the single most important next physical action to move this forward?"
            className="h-10 text-sm font-medium bg-bg-base/90 border-accent-blue/30 focus-visible:border-accent-blue focus-visible:ring-2 focus-visible:ring-accent-blue/20 text-text-primary px-3 shadow-inner"
          />
        </div>
      </div>

      {/* Progress Metric Strip */}
      <div className="p-3.5 rounded-lg border border-border bg-bg-surface">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">Task Progress</span>
            <span className="text-text-muted">•</span>
            <span className="text-text-secondary">
              {stats.done} of {stats.total} completed
            </span>
          </div>
          <span className="font-mono font-semibold text-text-primary">
            {stats.progress}%
          </span>
        </div>
        <ProgressBar progress={stats.progress} size="lg" />
      </div>

      {/* Workspace Tabs: Tasks & Overview */}
      <div className="space-y-4">
        {/* Tab Headers */}
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
          <button
            onClick={() => setActiveTab('tasks')}
            className={cn(
              'h-8 px-4 rounded-md text-xs font-medium transition-colors',
              activeTab === 'tasks'
                ? 'bg-bg-elevated text-text-primary border border-border shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            Tasks ({stats.total})
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={cn(
              'h-8 px-4 rounded-md text-xs font-medium transition-colors',
              activeTab === 'sessions'
                ? 'bg-bg-elevated text-text-primary border border-border shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            Sessions ({completedProjectSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'h-8 px-4 rounded-md text-xs font-medium transition-colors',
              activeTab === 'overview'
                ? 'bg-bg-elevated text-text-primary border border-border shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            Overview & Activity
          </button>
        </div>

        {/* TAB 1: Tasks */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Quick Add Task Bar */}
            <form
              onSubmit={handleCreateTask}
              className="flex items-center gap-2 p-1.5 rounded-lg border border-border bg-bg-surface"
            >
              <Input
                placeholder="Add a new task... (press Enter to save)"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="h-8 border-transparent bg-transparent focus-visible:ring-0 focus-visible:border-transparent text-xs"
              />

              {/* Priority for new task */}
              <Select
                value={newTaskPriority}
                onValueChange={(val) => setNewTaskPriority(val as Priority)}
              >
                <SelectTrigger className="w-24 h-7 text-xs border-border-subtle bg-bg-base shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="submit"
                size="sm"
                disabled={!newTaskTitle.trim()}
                className="gap-1 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </Button>
            </form>

            {/* Task Filters */}
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: `All (${stats.total})` },
                  { id: 'todo', label: `Todo (${stats.todo})` },
                  { id: 'in_progress', label: `In Progress (${stats.inProgress})` },
                  { id: 'done', label: `Done (${stats.done})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTaskFilter(tab.id)}
                  className={cn(
                    'h-6 px-2.5 rounded text-[11px] font-medium transition-colors',
                    taskFilter === tab.id
                      ? 'bg-bg-elevated text-text-primary border border-border shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Task Rows List */}
            <div className="rounded-lg border border-border bg-bg-surface overflow-hidden divide-y divide-border-subtle shadow-sm">
              {filteredTasks.length > 0 ? (
                <div className="p-1 space-y-0.5">
                  {filteredTasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-text-muted">
                  {taskFilter === 'all'
                    ? 'No tasks in this project yet. Add one above!'
                    : `No tasks matching status "${taskFilter}".`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Description & Details */}
            <div className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text-primary">
                  Project Description
                </h3>
                {descSaved && (
                  <span className="flex items-center gap-1 text-[10px] text-accent-green font-medium">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>
              <Textarea
                rows={3}
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={handleSaveDescription}
                placeholder="Describe project objectives, scope, or key milestones..."
                className="text-xs bg-bg-base"
              />
              <div className="text-[10px] text-text-muted">
                Changes save automatically when you click outside.
              </div>
            </div>

            {/* Metadata Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted">
                  Created
                </span>
                <div className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-text-muted" />
                  {new Date(project.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted">
                  Last Updated
                </span>
                <div className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-text-muted" />
                  {new Date(project.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted">
                  Current Status
                </span>
                <div>
                  <StatusBadge status={project.status} />
                </div>
              </div>
            </div>

            {/* Project Activity History */}
            <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border-subtle bg-bg-elevated/40">
                <h3 className="text-xs font-semibold text-text-primary">
                  Project Activity History
                </h3>
              </div>

              {projectActivities.length > 0 ? (
                <div className="p-3 divide-y divide-border-subtle">
                  {projectActivities.map((act) => (
                    <div key={act.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                      <div className="flex items-center justify-between text-text-primary">
                        <span>{act.description}</span>
                        <span className="font-mono text-[10px] text-text-muted">
                          {new Date(act.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-text-muted">
                  No activity logged yet for this project.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-accent-blue" /> Total Project Focus
                </span>
                <div className="font-mono text-lg font-bold text-text-primary">
                  {formatDuration(projectTotalDuration)}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1.5">
                  <History className="h-3 w-3 text-accent-green" /> Total Sessions
                </span>
                <div className="font-mono text-lg font-bold text-text-primary">
                  {completedProjectSessions.length}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-accent-purple" /> Last Worked
                </span>
                <div className="text-xs font-medium text-text-primary mt-1">
                  {latestSession ? formatTimeAgo(latestSession.endedAt || latestSession.updatedAt) : 'Never'}
                </div>
              </div>
            </div>

            {/* If there is an active session for THIS project */}
            {isActiveForThisProject && activeSession && (
              <div className="p-3.5 rounded-lg border border-accent-blue/30 bg-accent-blue/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-blue/20 text-accent-blue border border-accent-blue/30 shrink-0">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        Active: {activeSession.title}
                      </span>
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.2 rounded bg-accent-blue/20 text-accent-blue border border-accent-blue/30 font-semibold">
                        {activeSession.status}
                      </span>
                    </div>
                    {activeSession.objective && (
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {activeSession.objective}
                      </p>
                    )}
                    {sessionActionError && (
                      <p className="text-[11px] text-accent-red mt-1">
                        {sessionActionError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                  <span className="font-mono text-base font-bold text-accent-blue mr-1">
                    {formatTimer(activeSessionLiveMs)}
                  </span>
                  {activeSession.status === 'running' ? (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={handleSessionToggle}
                      className="gap-1 h-7 text-xs"
                    >
                      <Pause className="h-3 w-3" />
                      <span>Pause</span>
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={handleSessionToggle}
                      className="gap-1 h-7 text-xs"
                    >
                      <Play className="h-3 w-3" />
                      <span>Resume</span>
                    </Button>
                  )}
                  <Button
                    size="xs"
                    onClick={() => navigate('/sessions')}
                    className="gap-1 h-7 text-xs"
                  >
                    <span>Open</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Sessions List */}
            <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-elevated/40">
                <h3 className="text-xs font-semibold text-text-primary">
                  Recorded Sessions ({completedProjectSessions.length})
                </h3>
                <Button
                  size="xs"
                  onClick={() => setIsStartSessionOpen(true)}
                  className="gap-1 text-xs h-6"
                >
                  <Plus className="h-3 w-3" />
                  <span>New Session</span>
                </Button>
              </div>

              {completedProjectSessions.length > 0 ? (
                <div className="divide-y divide-border-subtle">
                  {completedProjectSessions.map((sess) => {
                    return (
                      <div
                        key={sess.id}
                        onClick={() => setSelectedSessionForDetail(sess)}
                        className="p-3.5 hover:bg-bg-hover/60 transition-colors cursor-pointer group space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
                              {sess.title}
                            </span>
                            {sess.outcome && (
                              <Badge
                                variant={
                                  sess.outcome === 'completed'
                                    ? 'success'
                                    : sess.outcome === 'blocked'
                                    ? 'warning'
                                    : 'secondary'
                                }
                                className="font-mono text-[9px] uppercase px-1.5 py-0"
                              >
                                {sess.outcome}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-xs font-semibold text-text-primary">
                              {formatDuration(sess.accumulatedDurationMs)}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono">
                              {formatTimeAgo(sess.endedAt || sess.updatedAt)}
                            </span>
                          </div>
                        </div>

                        {/* Excerpts */}
                        {(sess.accomplishments || sess.nextStep) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-0.5">
                            {sess.accomplishments && (
                              <p className="text-text-secondary truncate">
                                <span className="text-accent-green font-medium">Accomplished:</span>{' '}
                                {sess.accomplishments}
                              </p>
                            )}
                            {sess.nextStep && (
                              <p className="text-text-secondary truncate">
                                <span className="text-accent-blue font-medium">Next:</span>{' '}
                                {sess.nextStep}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-text-muted space-y-3">
                  <p>No work sessions recorded for this project yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsStartSessionOpen(true)}
                    className="gap-1.5 text-xs mx-auto"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Start First Session</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Start Session Dialog */}
      <StartSessionDialog
        open={isStartSessionOpen}
        onOpenChange={setIsStartSessionOpen}
        initialProjectId={project.id}
      />

      {/* Session Details Dialog */}
      <SessionDetailDialog
        session={
          selectedSessionForDetail
            ? { ...selectedSessionForDetail, project }
            : null
        }
        open={!!selectedSessionForDetail}
        onOpenChange={(open) => !open && setSelectedSessionForDetail(null)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open)
          if (!open) setDeleteError(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-text-primary">
                "{project.name}"
              </span>
              ? This action cannot be undone. All tasks will be deleted.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-2.5 text-xs text-accent-red">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteProject}
            >
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
