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
    } catch (err) {
      // Do not silently discard entered text if saving fails!
      const msg = err instanceof Error ? err.message : 'Failed to finalize session'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const outcomes: { id: OutcomeType; label: string; icon: typeof CheckCircle2; color: string }[] = [
    {
      id: 'completed',
      label: 'Completed',
      icon: CheckCircle2,
      color: 'text-accent-green border-accent-green/30 bg-accent-green/10',
    },
    {
      id: 'progress',
      label: 'Progress Made',
      icon: Clock,
      color: 'text-accent-blue border-accent-blue/30 bg-accent-blue/10',
    },
    {
      id: 'blocked',
      label: 'Blocked',
      icon: AlertCircle,
      color: 'text-accent-red border-accent-red/30 bg-accent-red/10',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-green/15 text-accent-green border border-accent-green/20">
                  <Flag className="h-3.5 w-3.5" />
                </div>
                <div>
                  <DialogTitle>Complete Work Session</DialogTitle>
                  <p className="text-[11px] text-text-secondary truncate max-w-[280px]">
                    {session.project ? `${session.project.icon || '📁'} ${session.project.name} • ` : ''}
                    {session.title}
                  </p>
                </div>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Document accomplishments, blockers, and next steps for this work session.
            </DialogDescription>
          </DialogHeader>

          {/* Prominent final duration banner */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-bg-base">
            <div>
              <span className="text-[10px] uppercase font-semibold text-text-muted">
                Final Session Duration
              </span>
              <div className="font-mono text-xl font-bold text-text-primary mt-0.5">
                {formatTimer(liveMs)}
                <span className="text-xs font-normal text-text-secondary ml-2">
                  ({formatDuration(liveMs)})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-elevated border border-border-subtle text-[11px] text-text-muted font-mono">
              <Sparkles className="h-3 w-3 text-accent-blue" />
              <span>Auto-saved to history</span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-md border border-accent-red/30 bg-accent-red/10 text-accent-red text-xs">
              {errorMessage}
            </div>
          )}

          {/* Outcome pill selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary">
              Session Outcome
            </label>
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
                      'flex items-center justify-center gap-1.5 h-8 px-2 rounded-md border text-xs font-medium transition-all',
                      isSelected
                        ? item.color + ' ring-1 ring-white/20'
                        : 'border-border bg-bg-base text-text-muted hover:text-text-primary hover:bg-bg-hover'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* What did you accomplish? */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary">
              What did you accomplish?
            </label>
            <Textarea
              placeholder="Key achievements, completed checklist items, pull requests..."
              rows={2}
              value={accomplishments}
              onChange={(e) => setAccomplishments(e.target.value)}
              autoFocus
            />
          </div>

          {/* Were there any blockers? */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary">
              Were there any blockers? <span className="text-text-muted">(Optional)</span>
            </label>
            <Textarea
              placeholder="Unresolved bugs, technical constraints, missing assets..."
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
            />
          </div>

          {/* What should you do next? */}
          <div className="space-y-2 p-2.5 rounded-md bg-accent-blue/5 border border-accent-blue/20">
            <label className="text-[11px] font-semibold text-accent-blue flex items-center justify-between">
              <span>What should you do next?</span>
              <span className="text-[10px] text-text-muted font-normal">Resumption anchor</span>
            </label>
            <Input
              placeholder="Immediate next step when resuming this project..."
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              className="border-accent-blue/30 focus-visible:border-accent-blue text-xs"
            />

            {/* Sync to project next action */}
            {session.projectId && (
              <div className="pt-2 border-t border-accent-blue/15 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={syncToNextAction}
                    onCheckedChange={(checked) => setSyncToNextAction(!!checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-[11px] text-text-secondary">
                    Update project's Next Action with this step
                  </span>
                </label>
                {project?.nextAction && (
                  <p className="text-[10px] text-text-muted pl-5 truncate">
                    Current: <span className="italic">"{project.nextAction}"</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Saving…' : 'Finalize & Complete'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
