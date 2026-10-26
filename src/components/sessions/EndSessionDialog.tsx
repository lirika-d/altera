import * as React from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { useSessionActions, useLiveElapsedMs, formatDuration, formatTimer } from '@/hooks/useSessions'
import { useProject } from '@/hooks/useProjects'
import { useTranslation } from '@/i18n'
import type { Session, Project } from '@/types'
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Flag,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EndSessionDialogProps {
  session: (Session & { project?: Project }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type OutcomeType = 'completed' | 'progress' | 'blocked'

export function EndSessionDialog({
  session,
  open,
  onOpenChange,
  onSuccess,
}: EndSessionDialogProps) {
  const { t, tx } = useTranslation()
  const { complete } = useSessionActions()
  const liveMs = useLiveElapsedMs(session || undefined)
  const linkedProject = useProject(session?.projectId)
  const project = session?.project || linkedProject

  // Preserve user input across attempts
  const [outcome, setOutcome] = React.useState<OutcomeType>('completed')
  const [accomplishments, setAccomplishments] = React.useState('')
  const [blockers, setBlockers] = React.useState('')
  const [nextStep, setNextStep] = React.useState('')
  const [syncToNextAction, setSyncToNextAction] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Initialize form when session is loaded
  React.useEffect(() => {
    if (session && open) {
      setAccomplishments(session.accomplishments || '')
      setBlockers(session.blockers || '')
      setNextStep(session.nextStep || '')
      setSyncToNextAction(true)
      if (session.outcome === 'progress' || session.outcome === 'blocked') {
        setOutcome(session.outcome)
      } else {
        setOutcome('completed')
      }
      setErrorMessage(null)
    }
  }, [session, open])

  if (!session) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await complete(session.id, {
        outcome,
        accomplishments: accomplishments.trim(),
        blockers: blockers.trim(),
        nextStep: nextStep.trim(),
        syncNextStepToProject: syncToNextAction,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch {
      // Do not silently discard entered text if saving fails!
      setErrorMessage(t('sessions.dialogs.finishFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const outcomes: { id: OutcomeType; label: string; icon: typeof CheckCircle2; color: string }[] = [
    {
      id: 'completed',
      label: 'Completed',
      icon: CheckCircle2,
      color: 'text-[#8a9e6b] border-[#8a9e6b]/40 bg-[#8a9e6b]/15',
    },
    {
      id: 'progress',
      label: 'Progress Made',
      icon: Clock,
      color: 'text-[#a3b899] border-[#a3b899]/40 bg-[#1f201c]',
    },
    {
      id: 'blocked',
      label: 'Blocked',
      icon: AlertCircle,
      color: 'text-amber-400 border-amber-500/40 bg-amber-500/15',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#141412] border-[#242420] text-[#eceeed]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8a9e6b]/15 text-[#8a9e6b] border border-[#8a9e6b]/20">
                  <Flag className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="font-serif text-lg text-[#eceeed]">
                    {t('sessions.dialogs.endTitle')}
                  </DialogTitle>
                  <p className="text-xs text-[#9ca3af] truncate max-w-[280px]">
                    {session.project ? `${session.project.icon || '📁'} ${session.project.name} • ` : ''}
                    {session.title}
                  </p>
                </div>
              </div>
            </div>
            <DialogDescription className="sr-only">
              {t('sessions.dialogs.endDesc')}
            </DialogDescription>
          </DialogHeader>

          {/* Prominent final duration banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#242420] bg-[#0e0e0d]">
            <div>
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {tx("Final Session Duration")}</span>
              <div className="font-mono text-xl font-bold text-[#eceeed] mt-0.5">
                {formatTimer(liveMs)}
                <span className="text-xs font-normal text-[#9ca3af] ml-2">
                  ({formatDuration(liveMs)})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a17] border border-[#242420] text-xs text-[#8a9e6b] font-mono">
              <Sparkles className="h-3.5 w-3.5 text-[#8a9e6b]" />
              <span>{tx("Auto-saved")}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Outcome pill selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#9ca3af]">
              {tx("Session Outcome")}</label>
            <div className="grid grid-cols-3 gap-2">
              {outcomes.map((item) => {
                const Icon = item.icon
                const isSelected = outcome === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOutcome(item.id)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg border text-xs font-medium transition-all duration-150',
                      isSelected
                        ? item.color + ' ring-1 ring-white/10 font-semibold'
                        : 'border-[#242420] bg-[#0e0e0d] text-[#6b7280] hover:text-[#eceeed] hover:bg-[#1a1a17]'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{tx(item.label)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* What did you accomplish? */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#9ca3af]">
              {t('sessions.dialogs.accomplishments')}
            </label>
            <Textarea
              placeholder={tx("Key achievements, completed checklist items, pull requests...")}
              rows={2}
              value={accomplishments}
              onChange={(e) => setAccomplishments(e.target.value)}
              className="bg-[#0e0e0d] border-[#242420] text-[#eceeed] focus-visible:border-[#8a9e6b]"
              autoFocus
            />
          </div>

          {/* Were there any blockers? */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#9ca3af]">
              {t('sessions.dialogs.blockers')} <span className="text-[#6b7280]">{tx("(Optional)")}</span>
            </label>
            <Textarea
              placeholder={tx("Unresolved bugs, technical constraints, missing assets...")}
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              className="bg-[#0e0e0d] border-[#242420] text-[#eceeed] focus-visible:border-[#8a9e6b]"
            />
          </div>

          {/* What should you do next? */}
          <div className="space-y-2 p-3 rounded-xl bg-[#8a9e6b]/5 border border-[#8a9e6b]/20">
            <label className="text-xs font-semibold text-[#8a9e6b] flex items-center justify-between">
              <span>{t('sessions.dialogs.nextAction')}</span>
              <span className="text-[10px] text-[#6b7280] font-normal">{tx("Resumption anchor")}</span>
            </label>
            <Input
              placeholder={tx("Immediate next step when resuming this project...")}
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              className="bg-[#0e0e0d] border-[#8a9e6b]/30 focus-visible:border-[#8a9e6b] text-xs text-[#eceeed]"
            />

            {/* Sync to project next action */}
            {session.projectId && (
              <div className="pt-2 border-t border-[#8a9e6b]/15 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={syncToNextAction}
                    onCheckedChange={(checked) => setSyncToNextAction(!!checked)}
                    className="h-3.5 w-3.5 data-[state=checked]:bg-[#8a9e6b] data-[state=checked]:border-[#8a9e6b]"
                  />
                  <span className="text-xs text-[#9ca3af]">
                    {tx("Update project's Next Action with this step")}</span>
                </label>
                {project?.nextAction && (
                  <p className="text-[11px] text-[#6b7280] pl-5.5 truncate">
                    {tx("Current:")} <span className="italic text-[#9ca3af]">"{project.nextAction}"</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#242420]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-[#9ca3af] hover:text-[#eceeed]"
            >
              {tx("Cancel")}</Button>
            <Button
              type="submit"
              variant="olive"
              disabled={isSubmitting}
              className="gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isSubmitting ? tx("Saving…") : t('sessions.dialogs.saveAndComplete')}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
