import * as React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ListFilter, CheckSquare, Plus } from 'lucide-react'
import { useActiveProjectTasks } from '@/hooks/useTasks'
import { useTaskScheduleSummaries } from '@/hooks/useTaskScheduleSummaries'
import { TaskRow } from '@/components/shared/TaskRow'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { EmptyState } from '@/components/shared/EmptyState'
import { useTranslation } from '@/i18n'
import type { Task, TaskStatus, Priority } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog'

const TASKS_PER_BATCH = 100
const EMPTY_TASKS: Task[] = []

export function MyTasks() {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queriedTasks = useActiveProjectTasks()
  const allTasks = queriedTasks ?? EMPTY_TASKS
  const taskIntentId = searchParams.get('task') || undefined
  const [statusFilter, setStatusFilter] = React.useState<'all' | TaskStatus>('all')
  const [priorityFilter, setPriorityFilter] = React.useState<'all' | Priority>('all')
  const [visibleTaskCount, setVisibleTaskCount] = React.useState(TASKS_PER_BATCH)
  const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false)
  const handledTaskIntentRef = React.useRef<string | null>(null)
  const scrolledTaskIntentRef = React.useRef<string | null>(null)
  const createTaskIntent = searchParams.get('action') === 'create'
  const initialTemplateId = searchParams.get('template') || undefined

  const closeCreateTask = (open: boolean) => {
    setIsCreateTaskOpen(open)
    if (!open && createTaskIntent) {
      const next = new URLSearchParams(searchParams)
      next.delete('action')
      next.delete('template')
      setSearchParams(next, { replace: true })
    }
  }

  React.useEffect(() => {
    if (!taskIntentId || queriedTasks === undefined) return
    const intentKey = `${location.key}:${taskIntentId}`
    if (!queriedTasks.some((task) => task.id === taskIntentId)) {
      const next = new URLSearchParams(searchParams)
      next.delete('task')
      setSearchParams(next, { replace: true })
      return
    }
    if (handledTaskIntentRef.current === intentKey) return
    handledTaskIntentRef.current = intentKey
    setStatusFilter('all')
    setPriorityFilter('all')
    setVisibleTaskCount(TASKS_PER_BATCH)
  }, [allTasks, location.key, queriedTasks, searchParams, setSearchParams, taskIntentId])

  React.useEffect(() => {
    if (!taskIntentId || queriedTasks === undefined) return
    const intentKey = `${location.key}:${taskIntentId}`
    if (scrolledTaskIntentRef.current === intentKey) return
    if (!queriedTasks.some((task) => task.id === taskIntentId)) return
    const element = document.getElementById(`task-${taskIntentId}`)
    if (!element) return
    scrolledTaskIntentRef.current = intentKey
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [location.key, queriedTasks, taskIntentId, statusFilter, priorityFilter, visibleTaskCount])

  const totalCount = allTasks.length
  const doneCount = allTasks.filter((t) => t.status === 'done').length
  const progress = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  const filteredTasks = allTasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
    return true
  })
  const visibleTasks = filteredTasks.slice(0, visibleTaskCount)
  const intentTask = taskIntentId ? filteredTasks.find((task) => task.id === taskIntentId) : undefined
  const pinnedIntentTask = intentTask && !visibleTasks.some((task) => task.id === intentTask.id) ? intentTask : undefined
  const renderedTasks = pinnedIntentTask ? [...visibleTasks, pinnedIntentTask] : visibleTasks
  const remainingTaskCount = Math.max(0, filteredTasks.length - visibleTasks.length - (pinnedIntentTask ? 1 : 0))
  const taskScheduleSummaries = useTaskScheduleSummaries(renderedTasks)

  return (
    <div className="px-5 py-5 md:px-7 md:py-6 max-w-5xl mx-auto space-y-5">
      {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl md:text-[28px] font-medium tracking-tight text-text-primary">
              {t('tasks.title')}
            </h1>
            <span className="font-mono text-xs text-[#8a9e6b] px-2.5 py-0.5 rounded-full bg-[#8a9e6b]/10 border border-[#8a9e6b]/25 font-semibold">
              {filteredTasks.length}
            </span>
          </div>
            <p className="text-[13px] md:text-sm text-text-secondary mt-1 font-sans">
            {t('tasks.subtitle')}
          </p>
        </div>

        {/* Global Task Completion Meter */}
        <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="olive" size="sm" onClick={() => { setIsCreateTaskOpen(true) }}><Plus className="h-3.5 w-3.5" />{t('tasks.create.open')}</Button>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-bg-surface">
          <div className="text-right">
            <div className="text-[11px] text-text-muted uppercase tracking-[0.04em] font-semibold">
              {t('tasks.doneRatio')}
            </div>
            <div className="text-sm font-mono font-semibold text-text-primary">
              {doneCount} <span className="text-text-muted">/</span> {totalCount}
            </div>
          </div>
          <ProgressBar progress={progress} showPercentage size="default" className="w-28" />
        </div>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-lg bg-bg-surface border border-border-subtle">
        {/* Status filters */}
        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: t('tasks.status.all') },
              { id: 'todo', label: t('tasks.status.todo') },
              { id: 'in_progress', label: t('tasks.status.in_progress') },
              { id: 'done', label: t('tasks.status.done') },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setVisibleTaskCount(TASKS_PER_BATCH) }}
              className={cn(
                'h-8 shrink-0 whitespace-nowrap px-3 rounded-md text-[13px] font-medium transition-colors duration-150',
                statusFilter === tab.id
                  ? 'bg-bg-elevated text-accent-olive border border-accent-olive/30 font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="min-w-0 w-full flex flex-wrap items-center gap-1.5 text-xs sm:w-auto">
          <ListFilter className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs text-text-secondary font-medium mr-1">{t('tasks.priority.label')}</span>
          {(
            [
              { id: 'all', label: t('tasks.priority.all') },
              { id: 'urgent', label: t('tasks.priority.urgent') },
              { id: 'high', label: t('tasks.priority.high') },
              { id: 'medium', label: t('tasks.priority.medium') },
              { id: 'low', label: t('tasks.priority.low') },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => { setPriorityFilter(p.id); setVisibleTaskCount(TASKS_PER_BATCH) }}
              className={cn(
                'h-7 shrink-0 whitespace-nowrap px-2.5 rounded-md text-xs font-sans transition-colors',
                priorityFilter === p.id
                  ? 'bg-accent-olive/15 text-accent-olive font-semibold border border-accent-olive/40'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
        {filteredTasks.length > 0 ? (
          <div className="p-1.5 space-y-0.5 divide-y divide-border-subtle">
            {renderedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                showProject={true}
                scheduleSummary={taskScheduleSummaries[task.id]}
                className={task.id === taskIntentId ? 'ring-1 ring-accent-olive/50' : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="py-12">
            <EmptyState
              icon={statusFilter === 'done' ? CheckSquare : CheckCircle2}
              title={t('tasks.noTasks')}
              description={t('tasks.noTasksDesc')}
            />
          </div>
        )}
      </div>
      {remainingTaskCount > 0 && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => setVisibleTaskCount((count) => count + TASKS_PER_BATCH)}>
            {t('common.loadMore')} ({remainingTaskCount})
          </Button>
        </div>
      )}
      <CreateTaskDialog key={initialTemplateId ?? 'blank'} open={isCreateTaskOpen || createTaskIntent} onOpenChange={closeCreateTask} initialTemplateId={initialTemplateId} />
    </div>
  )
}
