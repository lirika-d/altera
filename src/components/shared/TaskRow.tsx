import * as React from 'react'
import { Calendar, Trash2 } from 'lucide-react'
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
import type { Task, Project } from '@/types'
import { cn } from '@/lib/utils'

interface TaskRowProps {
  task: Task & { project?: Project }
  showProject?: boolean
  className?: string
}

function formatDate(date?: Date): string | null {
  if (!date) return null
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TaskRow({ task, showProject = false, className }: TaskRowProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [title, setTitle] = React.useState(task.title)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const isDone = task.status === 'done'

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

  return (
    <>
      <div
        className={cn(
          'group flex items-center justify-between gap-3 h-9 px-3 rounded-md border border-transparent hover:border-border hover:bg-bg-elevated transition-colors duration-150',
          isDone && 'opacity-60 bg-bg-surface/30',
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Completion Checkbox */}
          <Checkbox
            checked={isDone}
            onCheckedChange={handleStatusToggle}
            className="shrink-0"
          />

          {/* Priority Icon */}
          <PriorityIcon priority={task.priority} />

          {/* Project Tag if required */}
          {showProject && task.project && (
            <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-base border border-border-subtle shrink-0">
              {task.project.identifier}
            </span>
          )}

          {/* Title or Inline Edit */}
          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
              className="flex-1 h-6 bg-bg-base border border-accent-blue rounded px-1.5 text-xs text-text-primary focus:outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => setIsEditing(true)}
              className={cn(
                'text-xs text-text-primary truncate select-none cursor-default',
                isDone && 'line-through text-text-muted'
              )}
              title={task.title}
            >
              {task.title}
            </span>
          )}
        </div>

        {/* Right meta and actions */}
        <div className="flex items-center gap-2 shrink-0">
          {task.dueDate && (
            <span className="flex items-center gap-1 text-[10px] text-text-muted">
              <Calendar className="h-3 w-3" />
              {formatDate(task.dueDate)}
            </span>
          )}

          <button
            onClick={handleDeleteClick}
            className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded transition-all"
            title="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              "<span className="font-medium text-text-primary">{task.title}</span>" will be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
