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
import { useTranslation } from '@/i18n'
import type { Session, Project } from '@/types'
import { SessionKnowledgeLinks } from '@/components/knowledge/project'
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
  const { t, tx, i18n } = useTranslation()
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
      setErrorMessage(tx('Title cannot be empty.'))
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
      setSuccessMessage(tx('Session summary updated.'))
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
      // Preserve entered text if save fails!
      console.error('Session update failed')
      setErrorMessage(tx('Failed to update session'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSession(session.id)
      onOpenChange(false)
      onDeleteSuccess?.()
    } catch {
      console.error('Session deletion failed')
      setErrorMessage(tx('Failed to delete session'))
    }
  }

  const formatDate = (date: Date) => {
    const d = new Date(date)
    return d.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
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
        <Badge variant="success" className="gap-1 font-mono text-[10px] bg-[#8a9e6b]/15 text-[#8a9e6b] border-[#8a9e6b]/30">
          <CheckCircle2 className="h-3 w-3" />
          <span>{tx("Completed")}</span>
        </Badge>
      )
    }
    if (val === 'progress') {
      return (
        <Badge variant="default" className="gap-1 font-mono text-[10px] bg-[#1f201c] text-[#a3b899] border-[#2e2e28]">
          <Clock className="h-3 w-3" />
          <span>{tx("Progress")}</span>
        </Badge>
      )
    }
    if (val === 'blocked') {
      return (
        <Badge variant="warning" className="gap-1 font-mono text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
          <AlertCircle className="h-3 w-3" />
          <span>{tx("Blocked")}</span>
        </Badge>
      )
    }
    return val ? (
      <Badge variant="secondary" className="font-mono text-[10px] capitalize bg-[#1a1a17] text-[#9ca3af] border-[#242420]">
        {val}
      </Badge>
    ) : null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#141412] border-[#242420] text-[#eceeed]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{session.project?.icon || '📁'}</span>
              <div>
                {session.projectSnapshot && !session.project ? (
                  <span className="text-xs text-text-muted">{session.projectSnapshot.identifier} · {session.projectSnapshot.name} {tx("(deleted / удалён)")}</span>
                ) : <Link
                  to={`/projects/${session.projectId}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  title={tx("Open Project Workspace")}
                >
                  <span className="font-mono text-[10px] text-[#8a9e6b] px-2 py-0.5 rounded bg-[#8a9e6b]/10 border border-[#8a9e6b]/20 font-medium">
                    {session.project?.identifier || 'PROJECT'}
                  </span>
                  <span className="text-xs text-[#9ca3af] font-medium hover:text-[#eceeed]">
                    {session.project?.name || tx('Unknown Project')}
                  </span>
                </Link>}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {outcomeBadge(session.outcome)}
              <span
                className={cn(
                  'font-mono text-[10px] px-2 py-0.5 rounded-full capitalize border',
                  session.status === 'completed'
                    ? 'text-[#8a9e6b] bg-[#8a9e6b]/10 border-[#8a9e6b]/20'
                    : session.status === 'running'
                    ? 'text-[#8a9e6b] bg-[#8a9e6b]/10 border-[#8a9e6b]/20'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                )}
              >
                {session.status}
              </span>
            </div>
          </div>
          <DialogTitle className="font-serif text-lg text-[#eceeed] pt-1 text-left font-medium">
            {session.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('sessions.dialogs.detailTitle')}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 text-xs">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-lg border border-[#8a9e6b]/30 bg-[#8a9e6b]/10 text-[#8a9e6b] text-xs flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border border-[#242420] bg-[#0e0e0d] text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#6b7280] flex items-center gap-1 tracking-wider">
              <Clock className="h-3 w-3 text-[#8a9e6b]" /> {tx("Duration")}</span>
            <div className="font-mono font-bold text-[#eceeed] text-sm mt-0.5">
              {formatDuration(session.accumulatedDurationMs)}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#6b7280] flex items-center gap-1 tracking-wider">
              <Calendar className="h-3 w-3 text-[#8a9e6b]" /> {tx("Started")}</span>
            <div className="text-xs text-[#9ca3af] mt-0.5 font-mono truncate">
              {formatDate(session.startedAt)}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-semibold text-[#6b7280] flex items-center gap-1 tracking-wider">
              <Flag className="h-3 w-3 text-[#8a9e6b]" /> {tx("Linked Task")}</span>
            {session.taskId ? (
              linkedTask ? (
                <div className="flex items-center justify-between gap-1.5 mt-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <StatusBadge status={linkedTask.status} showLabel={false} />
                    <span className="text-xs text-[#eceeed] font-medium truncate" title={linkedTask.title}>
                      {linkedTask.title}
                    </span>
                  </div>
                  <Link
                    to={`/projects/${session.projectId}`}
                    onClick={() => onOpenChange(false)}
                    className="text-[10px] text-[#8a9e6b] hover:underline inline-flex items-center gap-0.5 shrink-0"
                    title={tx("View in Project Workspace")}
                  >
                    {tx("View")}<ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-[#6b7280] italic mt-0.5">
                  {tx("Task deleted or unavailable")}</div>
              )
            ) : (
              <div className="text-xs text-[#6b7280] mt-0.5 truncate">
                {tx("General project work")}</div>
            )}
          </div>
        </div>

        {/* Objective */}
        {session.objective && (
          <div className="p-3 rounded-xl bg-[#0e0e0d] border border-[#242420] space-y-1 text-xs">
            <span className="text-[10px] uppercase font-semibold text-[#8a9e6b] flex items-center gap-1 tracking-wider">
              <Target className="h-3 w-3 text-[#8a9e6b]" /> {tx("Objective")}</span>
            <p className="text-[#eceeed] leading-relaxed">{session.objective}</p>
          </div>
        )}

        {/* Summary Sections: View mode vs Edit mode */}
        {!isEditing ? (
          <div className="space-y-3 pt-1 text-xs">
            {/* Accomplishments */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#9ca3af] flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#8a9e6b]" />
                {t('sessions.dialogs.accomplishments')}
              </span>
              <div className="p-3 rounded-xl bg-[#0e0e0d] border border-[#242420] text-[#eceeed] whitespace-pre-wrap leading-relaxed min-h-[48px]">
                {session.accomplishments || (
                  <span className="text-[#6b7280] italic">{tx("No accomplishments recorded.")}</span>
                )}
              </div>
            </div>

            {/* Blockers */}
            {session.blockers && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t('sessions.dialogs.blockers')}
                </span>
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[#eceeed] whitespace-pre-wrap leading-relaxed">
                  {session.blockers}
                </div>
              </div>
            )}

            {/* Next Step */}
            {session.nextStep && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#8a9e6b] flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                  {t('sessions.dialogs.nextAction')}
                </span>
                <div className="p-3 rounded-xl bg-[#8a9e6b]/5 border border-[#8a9e6b]/20 text-[#eceeed] font-medium">
                  {session.nextStep}
                </div>
              </div>
            )}

            {/* Session Knowledge Notes & Resources */}
            <div className="pt-2">
              <SessionKnowledgeLinks
                sessionId={session.id}
                projectId={session.projectId}
                sessionTitle={session.title}
              />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3 pt-1">
            {/* Editable Title */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9ca3af]">
                {tx("Session Title")}</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-[#0e0e0d] border-[#242420] text-[#eceeed] focus-visible:border-[#8a9e6b]"
                required
              />
            </div>

            {/* Editable Outcome */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9ca3af]">
                {tx("Outcome")}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'completed', label: tx('Completed') },
                  { id: 'progress', label: tx('Progress Made') },
                  { id: 'blocked', label: tx('Blocked') },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOutcome(item.id)}
                    className={cn(
                      'h-7 px-2 rounded-lg border text-xs font-medium transition-colors',
                      outcome === item.id
                        ? 'border-[#8a9e6b] bg-[#8a9e6b]/15 text-[#8a9e6b] font-semibold'
                        : 'border-[#242420] bg-[#0e0e0d] text-[#6b7280] hover:bg-[#1a1a17] hover:text-[#eceeed]'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Accomplishments */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9ca3af]">
                {t('sessions.dialogs.accomplishments')}
              </label>
              <Textarea
                rows={3}
                value={accomplishments}
                onChange={(e) => setAccomplishments(e.target.value)}
                className="bg-[#0e0e0d] border-[#242420] text-[#eceeed] focus-visible:border-[#8a9e6b]"
                placeholder={tx("What did you get done?")}
              />
            </div>

            {/* Editable Blockers */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9ca3af]">
                {t('sessions.dialogs.blockers')}
              </label>
              <Textarea
                rows={2}
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                className="bg-[#0e0e0d] border-[#242420] text-[#eceeed] focus-visible:border-[#8a9e6b]"
                placeholder={tx("Any issues or roadblocks?")}
              />
            </div>

            {/* Editable Next Step */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#9ca3af]">
                {t('sessions.dialogs.nextAction')}
              </label>
              <Input
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                className="bg-[#0e0e0d] border-[#242420] text-[#eceeed] focus-visible:border-[#8a9e6b]"
                placeholder={tx("Next action when returning to this project...")}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="text-[#9ca3af] hover:text-[#eceeed]"
              >
                {tx("Cancel")}</Button>
              <Button type="submit" variant="olive" size="sm" disabled={isSaving}>
                <Check className="h-3 w-3 mr-1" />
                <span>{isSaving ? tx("Saving…") : tx("Save Changes")}</span>
              </Button>
            </div>
          </form>
        )}

        {/* Delete confirmation section */}
        {showDeleteConfirm && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-950/20 space-y-2">
            <div className="text-xs font-semibold text-red-300">
              {tx("Delete this session from history?")}</div>
            <p className="text-[11px] text-[#9ca3af]">
              {tx("This will remove this focus block and its recorded time from your statistics.")}</p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[#9ca3af] hover:text-[#eceeed]"
              >
                {tx("Cancel")}</Button>
              <Button
                type="button"
                size="xs"
                variant="danger"
                onClick={handleDelete}
              >
                {tx("Confirm Delete")}</Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-[#242420]">
          <div className="flex items-center gap-1.5">
            {!showDeleteConfirm && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-[#6b7280] hover:text-red-400 hover:bg-red-950/20 gap-1 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{tx("Delete")}</span>
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
                className="gap-1.5 bg-[#1a1a17] hover:bg-[#242420] text-[#eceeed] border-[#2e2e28]"
              >
                <Edit2 className="h-3.5 w-3.5 text-[#8a9e6b]" />
                <span>{tx("Edit Summary")}</span>
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="bg-[#1f201c] hover:bg-[#2e2e28] text-[#eceeed] border border-[#3a3a30]"
            >
              {tx("Close")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
