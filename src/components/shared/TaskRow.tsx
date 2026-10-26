import * as React from 'react'
import { Calendar, CalendarPlus, Clock3, Trash2, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Checkbox } from '@/components/ui/checkbox'
import { PriorityIcon } from '@/components/shared/PriorityIcon'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updateTask, deleteTask } from '@/db/db'
import { useEntityLinks } from '@/hooks/useKnowledge'
import { TaskKnowledgeLinks } from '@/components/knowledge/project'
import { useTranslation } from '@/i18n'
import type { Task, Project } from '@/types'
import { cn } from '@/lib/utils'
import { appRoutes } from '@/lib/appRoutes'
import { localDateKey, parseLocalDateTime } from '@/lib/calendarDates'
import type { TaskScheduleSummary } from '@/hooks/useTaskScheduleSummaries'

interface TaskRowProps {
  task: Task & { project?: Project }
  showProject?: boolean
  className?: string
  scheduleSummary?: TaskScheduleSummary
}

function formatDate(date?: Date, locale?: string): string | null {
  if (!date) return null
  const d = new Date(date)
  return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' })
}

export function TaskRow({ task, showProject = false, className, scheduleSummary }: TaskRowProps) {
  const { t, tx, i18n } = useTranslation()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = React.useState(false)
  const [title, setTitle] = React.useState(task.title)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [showKnowledgeDialog, setShowKnowledgeDialog] = React.useState(false)
  const [showDeadlineDialog, setShowDeadlineDialog] = React.useState(false)
  const [deadlineValue, setDeadlineValue] = React.useState('')
  const [deadlineError, setDeadlineError] = React.useState('')
  const [isSavingDeadline, setIsSavingDeadline] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const isDone = task.status === 'done'

  // Query linked knowledge items for this task
  const taskLinks = useEntityLinks('task', task.id)
  const linkedKnowledgeCount = taskLinks.all.length

  const handleStatusToggle = async () => {
    const nextStatus = isDone ? 'todo' : 'done'
    await updateTask(task.id, { status: nextStatus })
  }

  const handleTitleSubmit = async () => {
    setIsEditing(false)
    if (title.trim() && title.trim() !== task.title) {
      await updateTask(task.id, { title: title.trim() })
    } else {
      setTitle(task.title)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSubmit()
    } else if (e.key === 'Escape') {
      setTitle(task.title)
      setIsEditing(false)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteTask(task.id)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const openDeadlineDialog = () => {
    setDeadlineValue(task.dueDate ? localDateKey(task.dueDate) : '')
    setDeadlineError('')
    setShowDeadlineDialog(true)
  }

  const handleSaveDeadline = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingDeadline(true)
    setDeadlineError('')
    try {
      const dueDate = deadlineValue ? parseLocalDateTime(deadlineValue, '12:00') : undefined
      await updateTask(task.id, { dueDate })
      setShowDeadlineDialog(false)
    } catch {
      setDeadlineError(t('calendar.planner.deadlineSaveFailed'))
    } finally {
      setIsSavingDeadline(false)
    }
  }

  return (
    <>
      <div
        id={`task-${task.id}`}
        className={cn(
          'group flex items-center justify-between gap-3 min-h-10 px-3 rounded-md border border-transparent hover:border-border-subtle hover:bg-bg-elevated/45 transition-colors duration-150',
          isDone && 'bg-bg-base/40',
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Completion Checkbox */}
          <Checkbox
            checked={isDone}
            onCheckedChange={handleStatusToggle}
            aria-label={t('tasks.toggleCompletion', { title: task.title })}
            className="shrink-0 data-[state=checked]:bg-[#8a9e6b] data-[state=checked]:border-[#8a9e6b]"
          />

          {/* Priority Icon */}
          <PriorityIcon priority={task.priority} />

          {/* Project Tag if required */}
          {showProject && task.project && (
            <span className="font-mono text-[11px] text-accent-olive px-2 py-0.5 rounded bg-accent-olive/10 border border-accent-olive/20 shrink-0 font-medium">
              {task.project.identifier}
            </span>
          )}

          {/* Title or Inline Edit */}
          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={title}
              aria-label={t('tasks.editTitle', { title: task.title })}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
              className="flex-1 h-7 bg-bg-base border border-accent-olive rounded px-2 text-[13px] text-text-primary focus:outline-none ring-1 ring-accent-olive/30"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label={t('tasks.editTitle', { title: task.title })}
              className={cn(
                'min-w-0 border-0 bg-transparent p-0 text-left text-[13px] text-text-primary truncate font-sans focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-olive',
                isDone && 'line-through text-text-muted'
              )}
              title={task.title}
            >
              {task.title}
            </button>
          )}
        </div>

        {/* Right meta and actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {task.dueDate && (
            <span className="flex items-center gap-1 text-xs text-text-muted mr-1">
              <Calendar className="h-3.5 w-3.5 text-text-muted" />
              {formatDate(task.dueDate, i18n.language)}
            </span>
          )}

          {(task.dueDate || (!isDone && task.status !== 'cancelled')) && <button
            type="button"
            onClick={openDeadlineDialog}
            aria-label={`${t('calendar.planner.setDeadline')} ${task.title}`}
            title={t('calendar.planner.setDeadline')}
            className="flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-accent-olive focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-olive"
          ><Calendar aria-hidden="true" className="h-3.5 w-3.5" /></button>}

          {scheduleSummary?.nextBlock && <span className="hidden items-center gap-1 text-[10px] text-accent-olive md:flex" title={t('calendar.planner.scheduledCount', { count: scheduleSummary.count })}>
            <Clock3 aria-hidden="true" className="h-3 w-3" />
            <span>{new Intl.DateTimeFormat(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(scheduleSummary.nextBlock.scheduledStart)}</span>
            {scheduleSummary.count > 1 && <span>+{scheduleSummary.count - 1}</span>}
          </span>}

          {!isDone && task.status !== 'cancelled' && <button
            type="button"
            onClick={() => navigate(appRoutes.scheduleTask(task.id))}
            aria-label={`${t('calendar.planner.schedule')} ${task.title}`}
            title={t('calendar.planner.schedule')}
            className="flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-accent-olive focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-olive"
          ><CalendarPlus aria-hidden="true" className="h-3.5 w-3.5" /></button>}

          {/* Linked Knowledge Icon Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowKnowledgeDialog(true)
            }}
            className={cn(
              'p-1.5 rounded transition-all flex items-center gap-1 text-[10px]',
              linkedKnowledgeCount > 0
                ? 'opacity-100 text-[#8a9e6b] bg-[#8a9e6b]/10 border border-[#8a9e6b]/25 hover:bg-[#8a9e6b]/20'
                : 'opacity-0 group-hover:opacity-100 text-[#6b7280] hover:text-[#eceeed] hover:bg-[#242420]'
            )}
            title={
              linkedKnowledgeCount > 0
                ? `${linkedKnowledgeCount} linked note(s)/resource(s)`
                : 'Attach note or resource to task'
            }
            aria-label={`${t('tasks.manageKnowledge')}: ${task.title}`}
          >
            <FileText className="h-3.5 w-3.5" />
            {linkedKnowledgeCount > 0 && (
              <span className="font-mono text-[9px] font-bold">{linkedKnowledgeCount}</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleDeleteClick}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-[#6b7280] hover:text-red-400 hover:bg-red-950/20 rounded transition-all"
            title={tx("Delete task")}
            aria-label={t('tasks.deleteTask', { title: task.title })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Task Knowledge Links Dialog */}
      <Dialog open={showKnowledgeDialog} onOpenChange={setShowKnowledgeDialog}>
        <DialogContent className="max-w-lg bg-[#141412] border-[#242420] text-[#eceeed]">
          <DialogHeader>
            <DialogTitle className="text-base font-serif font-medium text-[#eceeed]">
              {t('tasks.knowledgeDialog.title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#9ca3af]">
              {t('tasks.knowledgeDialog.desc', { title: task.title })}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <TaskKnowledgeLinks
              taskId={task.id}
              projectId={task.projectId}
              taskTitle={task.title}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeadlineDialog} onOpenChange={open => { if (!isSavingDeadline) setShowDeadlineDialog(open) }}>
        <DialogContent className="max-w-sm bg-[#141412] border-[#242420] text-[#eceeed]">
          <form onSubmit={handleSaveDeadline} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg text-[#eceeed]">
                {t('calendar.planner.deadlineDialogTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#9ca3af]">
                {t('calendar.planner.deadlineDialogDescription', { title: task.title })}
              </DialogDescription>
            </DialogHeader>
            <label htmlFor={`task-deadline-${task.id}`} className="block space-y-1.5 text-xs text-[#9ca3af]">
              <span>{t('calendar.deadline')}</span>
              <input
                id={`task-deadline-${task.id}`}
                name="dueDate"
                type="date"
                value={deadlineValue}
                onChange={event => setDeadlineValue(event.target.value)}
                className="calendar-input"
              />
            </label>
            {deadlineError && <p role="alert" className="rounded border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-300">{deadlineError}</p>}
            <DialogFooter className="gap-2">
              {task.dueDate && <Button type="button" variant="ghost" onClick={() => setDeadlineValue('')} disabled={isSavingDeadline}>
                {t('calendar.planner.clearDeadline')}
              </Button>}
              <Button type="button" variant="outline" onClick={() => setShowDeadlineDialog(false)} disabled={isSavingDeadline}>
                {t('calendar.cancel')}
              </Button>
              <Button type="submit" disabled={isSavingDeadline}>
                {isSavingDeadline ? t('calendar.saving') : t('calendar.planner.saveDeadline')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm bg-[#141412] border-[#242420] text-[#eceeed]">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-[#eceeed]">
              {t('tasks.deleteDialog.title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#9ca3af]">
              {t('tasks.deleteDialog.desc', { title: task.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="text-[#9ca3af] hover:text-[#eceeed]"
            >
              {t('tasks.deleteDialog.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '...' : t('tasks.deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
