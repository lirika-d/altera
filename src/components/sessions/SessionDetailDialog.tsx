import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useSessionActions, formatDuration } from '@/hooks/useSessions'
import { useTask } from '@/hooks/useTasks'
import type { Session, Project } from '@/types'
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flag,
  Edit2,
  Trash2,
  Check,
  Target,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SessionDetailDialogProps {
  session: (Session & { project?: Project; taskTitle?: string }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleteSuccess?: () => void
}

export function SessionDetailDialog({
  session,
  open,
  onOpenChange,
  onDeleteSuccess,
}: SessionDetailDialogProps) {
  const { updateCompleted, deleteSession } = useSessionActions()
  const linkedTask = useTask(session?.taskId)

  const [isEditing, setIsEditing] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [outcome, setOutcome] = React.useState<string>('')
  const [accomplishments, setAccomplishments] = React.useState('')
  const [blockers, setBlockers] = React.useState('')
  const [nextStep, setNextStep] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)

  // Populate form fields on open
  React.useEffect(() => {
    if (session && open) {
      setTitle(session.title)
      setOutcome(session.outcome || 'completed')
      setAccomplishments(session.accomplishments || '')
      setBlockers(session.blockers || '')
      setNextStep(session.nextStep || '')
      setIsEditing(false)
      setErrorMessage(null)
      setSuccessMessage(null)
      setShowDeleteConfirm(false)
    }
  }, [session, open])

  if (!session) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErrorMessage('Title cannot be empty.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      await updateCompleted(session.id, {
        title: title.trim(),
        outcome: outcome || undefined,
        accomplishments: accomplishments.trim(),
        blockers: blockers.trim(),
        nextStep: nextStep.trim(),
      })
      setIsEditing(false)
      setSuccessMessage('Session summary updated.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      // Preserve entered text if save fails!
      const msg = err instanceof Error ? err.message : 'Failed to update session'
      setErrorMessage(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSession(session.id)
      onOpenChange(false)
      onDeleteSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete session'
      setErrorMessage(msg)
    }
  }

  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const outcomeBadge = (val?: string) => {
    if (val === 'completed') {
      return (
        <Badge variant="success" className="gap-1 font-mono">
          <CheckCircle2 className="h-3 w-3" />
          <span>Completed</span>
        </Badge>
      )
    }
    if (val === 'progress') {
      return (
        <Badge variant="default" className="gap-1 font-mono">
          <Clock className="h-3 w-3" />
          <span>Progress</span>
        </Badge>
      )
    }
    if (val === 'blocked') {
      return (
        <Badge variant="warning" className="gap-1 font-mono">
          <AlertCircle className="h-3 w-3" />
          <span>Blocked</span>
        </Badge>
      )
    }
    return val ? (
      <Badge variant="secondary" className="font-mono capitalize">
        {val}
      </Badge>
    ) : null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{session.project?.icon || '📁'}</span>
              <div>
                <Link
                  to={`/projects/${session.projectId}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  title="Open Project Workspace"
                >
                  <span className="font-mono text-[10px] text-accent-blue px-1.5 py-0.2 rounded bg-accent-blue/10 border border-accent-blue/20">
                    {session.project?.identifier || 'PROJECT'}
                  </span>
                  <span className="text-xs text-text-secondary font-medium hover:text-text-primary">
                    {session.project?.name || 'Unknown Project'}
                  </span>
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {outcomeBadge(session.outcome)}
              <span
                className={cn(
                  'font-mono text-[10px] px-2 py-0.5 rounded-full capitalize border',
                  session.status === 'completed'
                    ? 'text-accent-green bg-accent-green/10 border-accent-green/20'
                    : session.status === 'running'
                    ? 'text-accent-blue bg-accent-blue/10 border-accent-blue/20'
                    : 'text-accent-amber bg-accent-amber/10 border-accent-amber/20'
                )}
              >
                {session.status}
              </span>
            </div>
          </div>
          <DialogTitle className="text-sm font-semibold text-text-primary pt-1 text-left">
            {session.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed breakdown of work session accomplishments, duration, and blockers.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-2.5 rounded-md border border-accent-red/30 bg-accent-red/10 text-accent-red text-xs">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="p-2.5 rounded-md border border-accent-green/30 bg-accent-green/10 text-accent-green text-xs flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-lg border border-border bg-bg-base text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1">
              <Clock className="h-3 w-3" /> Duration
            </span>
            <div className="font-mono font-bold text-text-primary text-sm mt-0.5">
              {formatDuration(session.accumulatedDurationMs)}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Started
            </span>
            <div className="text-[11px] text-text-secondary mt-0.5 font-mono truncate">
              {formatDate(session.startedAt)}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1">
              <Flag className="h-3 w-3" /> Linked Task
            </span>
            {session.taskId ? (
              linkedTask ? (
                <div className="flex items-center justify-between gap-1.5 mt-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <StatusBadge status={linkedTask.status} showLabel={false} />
                    <span className="text-[11px] text-text-primary font-medium truncate" title={linkedTask.title}>
                      {linkedTask.title}
                    </span>
                  </div>
                  <Link
                    to={`/projects/${session.projectId}`}
                    onClick={() => onOpenChange(false)}
                    className="text-[10px] text-accent-blue hover:underline inline-flex items-center gap-0.5 shrink-0"
                    title="View in Project Workspace"
                  >
                    View <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>
              ) : (
                <div className="text-[11px] text-text-muted italic mt-0.5">
                  Task deleted or unavailable
                </div>
              )
            ) : (
              <div className="text-[11px] text-text-muted mt-0.5 truncate">
                General project work
              </div>
            )}
          </div>
        </div>

        {/* Objective */}
        {session.objective && (
          <div className="p-2.5 rounded-md bg-bg-base border border-border-subtle space-y-1 text-xs">
            <span className="text-[10px] uppercase font-semibold text-text-muted flex items-center gap-1">
              <Target className="h-3 w-3 text-accent-purple" /> Objective
            </span>
            <p className="text-text-primary leading-relaxed">{session.objective}</p>
          </div>
        )}

        {/* Summary Sections: View mode vs Edit mode */}
        {!isEditing ? (
          <div className="space-y-3 pt-1 text-xs">
            {/* Accomplishments */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent-green" />
                Accomplishments
              </span>
              <div className="p-2.5 rounded-md bg-bg-base border border-border-subtle text-text-primary whitespace-pre-wrap leading-relaxed min-h-[44px]">
                {session.accomplishments || (
                  <span className="text-text-muted italic">No accomplishments recorded.</span>
                )}
              </div>
            </div>

            {/* Blockers */}
            {session.blockers && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-accent-red flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Blockers Encountered
                </span>
                <div className="p-2.5 rounded-md bg-accent-red/5 border border-accent-red/20 text-text-primary whitespace-pre-wrap leading-relaxed">
                  {session.blockers}
                </div>
              </div>
            )}

            {/* Next Step */}
            {session.nextStep && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-accent-blue flex items-center gap-1">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Next Step
                </span>
                <div className="p-2.5 rounded-md bg-accent-blue/5 border border-accent-blue/20 text-text-primary font-medium">
                  {session.nextStep}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3 pt-1">
            {/* Editable Title */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-secondary">
                Session Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Editable Outcome */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-secondary">
                Outcome
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'completed', label: 'Completed' },
                  { id: 'progress', label: 'Progress Made' },
                  { id: 'blocked', label: 'Blocked' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOutcome(item.id)}
                    className={cn(
                      'h-7 px-2 rounded border text-xs font-medium transition-colors',
                      outcome === item.id
                        ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                        : 'border-border bg-bg-base text-text-muted hover:bg-bg-hover hover:text-text-primary'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Accomplishments */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-secondary">
                Accomplishments
              </label>
              <Textarea
                rows={3}
                value={accomplishments}
                onChange={(e) => setAccomplishments(e.target.value)}
                placeholder="What did you get done?"
              />
            </div>

            {/* Editable Blockers */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-secondary">
                Blockers
              </label>
              <Textarea
                rows={2}
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="Any issues or roadblocks?"
              />
            </div>

            {/* Editable Next Step */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-secondary">
                Next Step
              </label>
              <Input
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="Next action when returning to this project..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                <Check className="h-3 w-3 mr-1" />
                <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
              </Button>
            </div>
          </form>
        )}

        {/* Delete confirmation section */}
        {showDeleteConfirm && (
          <div className="p-3 rounded-lg border border-accent-red/30 bg-accent-red/10 space-y-2">
            <div className="text-xs font-semibold text-accent-red">
              Delete this session from history?
            </div>
            <p className="text-[11px] text-text-secondary">
              This will remove this focus block and its recorded time from your statistics.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="xs"
                variant="danger"
                onClick={handleDelete}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border-subtle">
          <div className="flex items-center gap-1.5">
            {!showDeleteConfirm && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-text-muted hover:text-accent-red hover:bg-accent-red/10 gap-1 text-[11px]"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && session.status === 'completed' && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1.5"
              >
                <Edit2 className="h-3 w-3 text-accent-blue" />
                <span>Edit Summary</span>
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
