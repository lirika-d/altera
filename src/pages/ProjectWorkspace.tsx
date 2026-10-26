import * as React from 'react'
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom'
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
  BookOpen,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useProject } from '@/hooks/useProjects'
import { useProjectTasks, useProjectTaskStats } from '@/hooks/useTasks'
import { useTaskScheduleSummaries } from '@/hooks/useTaskScheduleSummaries'
import { useRecentActivity } from '@/hooks/useActivity'
import { useKnowledgeCounts } from '@/hooks/useKnowledge'
import { ProjectKnowledgeTab } from '@/components/knowledge/project'
import { ProjectScheduleSection } from '@/components/calendar/ProjectScheduleSection'
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

function formatTimeAgo(date: Date | string | undefined, lang: string): string {
  if (!date) return lang === 'ru' ? 'Никогда' : 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (lang === 'ru') {
    if (minutes < 1) return 'только что'
    if (minutes < 60) return `${minutes}м назад`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}ч назад`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'вчера'
    return `${days}д назад`
  }
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export function ProjectWorkspace() {
  const { t, tx, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const project = useProject(id)
  const queriedTasks = useProjectTasks(id)
  const tasks = queriedTasks ?? []
  const taskScheduleSummaries = useTaskScheduleSummaries(tasks)
  const taskIntentId = searchParams.get('task') || undefined
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
      // useSessionActions keeps error state for inline display.
    }
  }

  // Knowledge counts for this project
  const knowledgeCounts = useKnowledgeCounts(id)
  const totalKnowledgeCount = knowledgeCounts.notes + knowledgeCounts.resources

  // Active workspace tab: 'tasks' | 'overview' | 'sessions' | 'knowledge'
  const [activeTab, setActiveTab] = React.useState<
    'tasks' | 'overview' | 'sessions' | 'knowledge'
  >('tasks')
  const [taskFilter, setTaskFilter] = React.useState<'all' | TaskStatus>('all')
  const handledTaskIntentRef = React.useRef<string | null>(null)
  const scrolledTaskIntentRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!taskIntentId || queriedTasks === undefined) return
    const intentKey = `${location.key}:${id}:${taskIntentId}`
    if (!queriedTasks.some((task) => task.id === taskIntentId)) {
      const next = new URLSearchParams(searchParams)
      next.delete('task')
      setSearchParams(next, { replace: true })
      return
    }
    if (handledTaskIntentRef.current === intentKey) return
    handledTaskIntentRef.current = intentKey
    setActiveTab('tasks')
    setTaskFilter('all')
  }, [id, location.key, queriedTasks, searchParams, setSearchParams, taskIntentId])

  React.useEffect(() => {
    if (!taskIntentId || activeTab !== 'tasks' || queriedTasks === undefined) return
    const intentKey = `${location.key}:${id}:${taskIntentId}`
    if (scrolledTaskIntentRef.current === intentKey) return
    const taskExists = queriedTasks.some((task) => task.id === taskIntentId)
    if (!taskExists) return
    const element = document.getElementById(`task-${taskIntentId}`)
    if (!element) return
    scrolledTaskIntentRef.current = intentKey
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeTab, id, location.key, queriedTasks, taskIntentId])

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

  // Dialogs
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isStartSessionOpen, setIsStartSessionOpen] = React.useState(false)
  const [selectedSessionForDetail, setSelectedSessionForDetail] = React.useState<Session | null>(null)

  // Update lastVisitedAt on mount
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
          title={t('workspace.notFound')}
          description={t('workspace.notFoundDesc')}
          actionLabel={t('workspace.backToProjects')}
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
    } catch {
      console.error('Project deletion failed')
      setDeleteError(t('projects.deleteFailed'))
    }
  }

  // Filter tasks
  const filteredTasks =
    taskFilter === 'all'
      ? tasks
      : tasks.filter((t) => t.status === taskFilter)
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* ─── Top Navigation Breadcrumbs & Actions ─── */}
      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t('workspace.backToProjects')}</span>
        </Link>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-text-muted hover:text-accent-red hover:bg-accent-red/10 gap-1 text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>{t('projects.actions.delete')}</span>
        </Button>
      </div>

      {/* ─── Project Header Banner (Stitch Refined) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 p-6 rounded-xl border border-border bg-bg-surface shadow-xs">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[5px] text-base bg-bg-base border border-border-subtle shrink-0 select-none"
              style={{ borderColor: `${project.color}50` }}
            >
              {project.icon || '📁'}
            </span>
            <span className="font-mono text-xs font-semibold text-accent-olive tracking-wider">
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
              className="font-serif text-2xl md:text-3xl font-medium bg-bg-base text-text-primary border border-accent-olive/70 rounded px-2 py-0.5 w-full focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="font-serif text-2xl md:text-3xl font-medium text-text-primary hover:text-accent-olive cursor-pointer transition-colors leading-tight"
              title={tx("Click to rename")}
            >
              {project.name}
            </h1>
          )}

          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
            {project.description || 'No description provided.'}
          </p>
        </div>

        {/* Project Meta Controls (Status & Priority) */}
        <div className="flex sm:flex-col items-center sm:items-end gap-2.5 shrink-0 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">{t('workspace.settings.status')}:</span>
            <Select
              value={project.status}
              onValueChange={(val) =>
                updateProject(project.id, { status: val as ProjectStatus })
              }
            >
              <SelectTrigger className="w-32 h-7.5 text-xs bg-bg-base border-border-subtle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-bg-surface border-border">
                <SelectItem value="active">{t('projects.filters.active')}</SelectItem>
                <SelectItem value="backlog">{t('projects.filters.backlog')}</SelectItem>
                <SelectItem value="paused">{t('projects.filters.paused')}</SelectItem>
                <SelectItem value="completed">{t('projects.filters.completed')}</SelectItem>
                <SelectItem value="archived">{t('projects.filters.archived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">{t('workspace.settings.priority')}:</span>
            <Select
              value={project.priority}
              onValueChange={(val) =>
                updateProject(project.id, { priority: val as Priority })
              }
            >
              <SelectTrigger className="w-28 h-7.5 text-xs bg-bg-base border-border-subtle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-bg-surface border-border">
                <SelectItem value="urgent">{t('tasks.priority.urgent')}</SelectItem>
                <SelectItem value="high">{t('tasks.priority.high')}</SelectItem>
                <SelectItem value="medium">{t('tasks.priority.medium')}</SelectItem>
                <SelectItem value="low">{t('tasks.priority.low')}</SelectItem>
                <SelectItem value="none">{tx("None")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start / Resume Session Action */}
          <div className="pt-1">
            {isActiveForThisProject && activeSession ? (
              <Button
                size="sm"
                onClick={() => navigate('/sessions')}
                className="bg-[#273220] hover:bg-[#324029] text-accent-olive border border-accent-olive/40 gap-1.5 shadow-xs text-xs h-7.5"
                title={tx("View active session in Sessions")}
              >
                <span className="relative flex h-2 w-2">
                  {activeSession.status === 'running' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-olive opacity-75" />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex rounded-full h-2 w-2',
                      activeSession.status === 'running' ? 'bg-accent-olive' : 'bg-accent-amber'
                    )}
                  />
                </span>
                <span className="font-mono font-bold">{formatTimer(activeSessionLiveMs)}</span>
                <span className="text-[10px] text-text-secondary capitalize">({activeSession.status})</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="olive"
                onClick={() => setIsStartSessionOpen(true)}
                className="gap-1.5 text-xs h-7.5 shadow-xs"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>{t('workspace.startSession')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Signature Continuity Banner ("Continue where you left off") ─── */}
      {latestSession ? (
        <div className="rounded-xl border border-border bg-gradient-to-br from-[#181816] via-[#141412] to-[#111110] p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-accent-olive/20 text-accent-olive border border-accent-olive/30 shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-text-primary tracking-wide">
                  {t('dashboard.continueWorking')}
                </h3>
                <p className="text-[10px] text-text-muted">
                  {latestSession.title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 rounded bg-bg-base border border-border-subtle">
                {formatTimeAgo(latestSession.endedAt || latestSession.updatedAt, i18n.language)} • {formatDuration(latestSession.accumulatedDurationMs)}
              </span>
              <Button
                size="xs"
                variant="olive"
                onClick={() => {
                  if (activeSession) {
                    navigate('/sessions')
                  } else {
                    setIsStartSessionOpen(true)
                  }
                }}
                className="gap-1 text-xs h-6.5"
              >
                <Play className="h-2.5 w-2.5 fill-current" />
                <span>{t('dashboard.resumeWork')}</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Last Accomplishment */}
            <div className="p-3 rounded-lg border border-border-subtle bg-bg-base/70 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-green flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {t('sessions.dialogs.accomplishments')}
              </span>
              <p className="text-xs text-text-primary line-clamp-3 leading-relaxed">
                {latestSession.accomplishments || (
                  <span className="text-text-muted italic">{tx("None recorded.")}</span>
                )}
              </p>
            </div>

            {/* Blockers */}
            <div className="p-3 rounded-lg border border-border-subtle bg-bg-base/70 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-amber flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {t('sessions.dialogs.blockers')}
              </span>
              <p className="text-xs text-text-primary line-clamp-3 leading-relaxed">
                {latestSession.blockers || (
                  <span className="text-text-muted italic">{tx("None reported. Flow was smooth.")}</span>
                )}
              </p>
            </div>

            {/* Planned Next Step */}
            <div className="p-3 rounded-lg border border-accent-olive/30 bg-accent-olive/10 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-olive flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> {t('sessions.dialogs.nextAction')}
              </span>
              <p className="text-xs text-text-primary font-medium line-clamp-3 leading-relaxed">
                {latestSession.nextStep || project.nextAction || (
                  <span className="text-text-muted italic font-normal">{tx("No next step specified.")}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── PROMINENT "NEXT ACTION" FIELD (Stitch Highlight) ─── */}
      <div className="relative p-5 rounded-xl border border-border bg-bg-surface shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#273220] text-accent-olive border border-accent-olive/40 shadow-xs">
              <Target className="h-3 w-3 stroke-[2.5]" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-section text-accent-olive">
              {t('workspace.nextActionLabel')}
            </span>
          </div>

          {nextActionSaved && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-accent-green animate-in fade-in">
              <Check className="h-3 w-3" /> {t('common.saved')}
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
            placeholder={t('workspace.nextActionPlaceholder')}
            className="h-10 text-xs font-medium bg-bg-base/80 border-border-subtle focus-visible:border-accent-olive/70 text-text-primary px-3 shadow-inner"
          />
        </div>
      </div>

      {/* ─── Progress Metric Strip ─── */}
      <div className="p-4 rounded-xl border border-border bg-bg-surface">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">{t('workspace.stats.progress')}</span>
            <span className="text-text-muted">•</span>
            <span className="text-text-secondary">
              {stats.done} / {stats.total} {t('workspace.stats.tasksResolved')}
            </span>
          </div>
          <span className="font-mono font-semibold text-text-primary">
            {stats.progress}%
          </span>
        </div>
        <ProgressBar progress={stats.progress} size="sm" />
      </div>

      {/* ─── Workspace Tabs: Tasks, Sessions, Knowledge, Overview ─── */}
      <div className="space-y-4">
        {/* Tab Headers */}
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tasks')}
            className={cn(
              'h-8 px-3.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
              activeTab === 'tasks'
                ? 'bg-bg-elevated text-text-primary border border-border/80 shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
            )}
          >
            {t('workspace.tabs.tasks')} ({stats.total})
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={cn(
              'h-8 px-3.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
              activeTab === 'sessions'
                ? 'bg-bg-elevated text-text-primary border border-border/80 shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
            )}
          >
            {t('workspace.tabs.sessions')} ({completedProjectSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={cn(
              'h-8 px-3.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap',
              activeTab === 'knowledge'
                ? 'bg-bg-elevated text-text-primary border border-border/80 shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
            )}
          >
            <BookOpen className="h-3.5 w-3.5 text-accent-olive" />
            <span>{t('workspace.tabs.knowledge')} ({totalKnowledgeCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              'h-8 px-3.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
              activeTab === 'overview'
                ? 'bg-bg-elevated text-text-primary border border-border/80 shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
            )}
          >
            {t('workspace.tabs.overview')}
          </button>
        </div>

        {/* TAB 1: Tasks */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Quick Add Task Bar */}
            <form
              onSubmit={handleCreateTask}
              className="flex items-center gap-2 p-1.5 rounded-xl border border-border bg-bg-surface"
            >
              <Input
                placeholder={t('workspace.newTask.placeholder')}
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
                <SelectContent className="bg-bg-surface border-border">
                  <SelectItem value="urgent">{t('tasks.priority.urgent')}</SelectItem>
                  <SelectItem value="high">{t('tasks.priority.high')}</SelectItem>
                  <SelectItem value="medium">{t('tasks.priority.medium')}</SelectItem>
                  <SelectItem value="low">{t('tasks.priority.low')}</SelectItem>
                  <SelectItem value="none">{tx("None")}</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="submit"
                size="xs"
                variant="olive"
                disabled={!newTaskTitle.trim()}
                className="gap-1 shrink-0 h-7 px-3 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('workspace.newTask.button')}</span>
              </Button>
            </form>

            {/* Task Filters */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `${t('tasks.status.all')} (${stats.total})` },
                  { id: 'todo', label: `${t('tasks.status.todo')} (${stats.todo})` },
                  { id: 'in_progress', label: `${t('tasks.status.in_progress')} (${stats.inProgress})` },
                  { id: 'done', label: `${t('tasks.status.done')} (${stats.done})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTaskFilter(tab.id)}
                  className={cn(
                    'h-6 px-2.5 rounded text-[11px] font-medium transition-colors',
                    taskFilter === tab.id
                      ? 'bg-bg-elevated text-text-primary border border-border/80 shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Task Rows List */}
            <div className="rounded-xl border border-border bg-bg-surface overflow-hidden divide-y divide-border-subtle shadow-xs">
              {filteredTasks.length > 0 ? (
                <div className="p-1 space-y-0.5">
                  {filteredTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      scheduleSummary={taskScheduleSummaries[task.id]}
                      className={task.id === taskIntentId ? 'ring-1 ring-accent-olive/50' : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-text-muted">
                  {t('tasks.noTasks')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <ProjectScheduleSection projectId={project.id} />
            {/* Description & Details */}
            <div className="rounded-xl border border-border bg-bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text-primary">
                  {t('workspace.settings.description')}
                </h3>
                {descSaved && (
                  <span className="flex items-center gap-1 text-[10px] text-accent-green font-medium">
                    <Check className="h-3 w-3" /> {t('common.saved')}
                  </span>
                )}
              </div>
              <Textarea
                rows={3}
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={handleSaveDescription}
                placeholder={tx("Describe project objectives, scope, or key milestones...")}
                className="text-xs bg-bg-base border-border-subtle"
              />
              <div className="text-[10px] text-text-muted">
                {tx("Changes save automatically when you click outside.")}</div>
            </div>

            {/* Metadata Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted tracking-section">
                  {tx("Created")}</span>
                <div className="text-xs font-medium text-text-primary flex items-center gap-1.5 pt-1">
                  <Calendar className="h-3.5 w-3.5 text-text-muted" />
                  {new Date(project.createdAt).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted tracking-section">
                  {tx("Last Updated")}</span>
                <div className="text-xs font-medium text-text-primary flex items-center gap-1.5 pt-1">
                  <Clock className="h-3.5 w-3.5 text-text-muted" />
                  {new Date(project.updatedAt).toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted tracking-section">
                  {t('workspace.settings.status')}
                </span>
                <div className="pt-1">
                  <StatusBadge status={project.status} />
                </div>
              </div>
            </div>

            {/* Project Activity History */}
            <div className="rounded-xl border border-border bg-bg-surface overflow-hidden shadow-xs">
              <div className="px-5 py-3 border-b border-border-subtle bg-bg-elevated/40">
                <h3 className="text-xs font-semibold text-text-primary">
                  {t('dashboard.recentActivity')}
                </h3>
              </div>

              {projectActivities.length > 0 ? (
                <div className="p-4 divide-y divide-border-subtle">
                  {projectActivities.map((act) => (
                    <div key={act.id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                      <div className="flex items-center justify-between text-text-primary">
                        <span>{act.description}</span>
                        <span className="font-mono text-[10px] text-text-muted">
                          {new Date(act.createdAt).toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-text-muted">
                  {t('dashboard.noActivity')}
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
              <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1.5 tracking-section">
                  <Clock className="h-3 w-3 text-accent-olive" /> {t('workspace.stats.focusTime')}
                </span>
                <div className="font-mono text-lg font-bold text-text-primary pt-0.5">
                  {formatDuration(projectTotalDuration)}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1.5 tracking-section">
                  <History className="h-3 w-3 text-accent-green" /> {t('workspace.stats.sessions')}
                </span>
                <div className="font-mono text-lg font-bold text-text-primary pt-0.5">
                  {completedProjectSessions.length}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-bg-surface space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1.5 tracking-section">
                  <Calendar className="h-3 w-3 text-accent-purple" /> {tx("Last Worked")}</span>
                <div className="text-xs font-medium text-text-primary pt-1">
                  {latestSession ? formatTimeAgo(latestSession.endedAt || latestSession.updatedAt, i18n.language) : tx("Never")}
                </div>
              </div>
            </div>

            {/* If there is an active session for THIS project */}
            {isActiveForThisProject && activeSession && (
              <div className="p-4 rounded-xl border border-accent-olive/40 bg-accent-olive/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#273220] text-accent-olive border border-accent-olive/30 shrink-0">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        {t('sessions.activePanel.currentSprint')}: {activeSession.title}
                      </span>
                      <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-accent-olive/20 text-accent-olive border border-accent-olive/30 font-semibold">
                        {activeSession.status === 'running' ? t('sessions.activePanel.running') : t('sessions.activePanel.paused')}
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
                  <span className="font-mono text-base font-bold text-accent-olive mr-1">
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
                      <span>{t('sessions.activePanel.pause')}</span>
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={handleSessionToggle}
                      className="gap-1 h-7 text-xs"
                    >
                      <Play className="h-3 w-3" />
                      <span>{t('sessions.activePanel.resume')}</span>
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="olive"
                    onClick={() => navigate('/sessions')}
                    className="gap-1 h-7 text-xs"
                  >
                    <span>{t('session.open')}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Sessions List */}
            <div className="rounded-xl border border-border bg-bg-surface overflow-hidden shadow-xs">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-bg-elevated/40">
                <h3 className="text-xs font-semibold text-text-primary">
                  {t('sessions.history.title')} ({completedProjectSessions.length})
                </h3>
                <Button
                  size="xs"
                  variant="olive"
                  onClick={() => setIsStartSessionOpen(true)}
                  className="gap-1 text-xs h-6.5 px-2.5"
                >
                  <Plus className="h-3 w-3" />
                  <span>{t('sessions.newSession')}</span>
                </Button>
              </div>

              {completedProjectSessions.length > 0 ? (
                <div className="divide-y divide-border-subtle">
                  {completedProjectSessions.map((sess) => {
                    return (
                      <div
                        key={sess.id}
                        onClick={() => setSelectedSessionForDetail(sess)}
                        className="p-4 hover:bg-bg-hover/60 transition-colors cursor-pointer group space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-medium text-text-primary group-hover:text-accent-olive transition-colors truncate">
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
                              {formatTimeAgo(sess.endedAt || sess.updatedAt, i18n.language)}
                            </span>
                          </div>
                        </div>

                        {/* Excerpts */}
                        {(sess.accomplishments || sess.nextStep) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-0.5">
                            {sess.accomplishments && (
                              <p className="text-text-secondary truncate">
                                <span className="text-accent-green font-medium">{tx("Accomplished:")}</span>{' '}
                                {sess.accomplishments}
                              </p>
                            )}
                            {sess.nextStep && (
                              <p className="text-text-secondary truncate">
                                <span className="text-accent-olive font-medium">{tx("Next:")}</span>{' '}
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
                  <p>{t('sessions.history.noHistory')}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsStartSessionOpen(true)}
                    className="gap-1.5 text-xs mx-auto"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>{t('sessions.activePanel.startPrompt')}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Knowledge Hub (Project Notes, Resources & Attachments) */}
        {activeTab === 'knowledge' && (
          <ProjectKnowledgeTab projectId={project.id} />
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
        <DialogContent className="max-w-md bg-bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-text-primary">
              {t('workspace.settings.confirmDeleteTitle', { name: project.name })}
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary leading-relaxed pt-1">
              {t('workspace.settings.confirmDeleteDesc')}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-2.5 text-xs text-accent-red">
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteProject}
              className="text-xs"
            >
              {t('projects.actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
