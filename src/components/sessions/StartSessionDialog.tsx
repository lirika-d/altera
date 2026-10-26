import * as React from 'react'
import { useNavigate } from 'react-router-dom'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjects } from '@/hooks/useProjects'
import { useProjectTasks } from '@/hooks/useTasks'
import { useActiveSession, useSessionActions } from '@/hooks/useSessions'
import { useTranslation } from '@/i18n'
import { SessionError } from '@/db/sessions'
import { Timer, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

interface StartSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProjectId?: string
  initialTaskId?: string
  initialTitle?: string
  scheduledBlockId?: string
}

export function StartSessionDialog({
  open,
  onOpenChange,
  initialProjectId,
  initialTaskId,
  initialTitle,
  scheduledBlockId,
}: StartSessionDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const allProjects = useProjects() || []
  const activeProjects = allProjects.filter((p) => p.status !== 'archived')
  const firstActiveProjectId = activeProjects[0]?.id
  const activeSession = useActiveSession()
  const { start } = useSessionActions()

  const [projectId, setProjectId] = React.useState<string>(initialProjectId || '')
  const [title, setTitle] = React.useState('')
  const [taskId, setTaskId] = React.useState<string>('none')
  const [objective, setObjective] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Dynamically load tasks for the selected project
  const projectTasks = useProjectTasks(projectId || undefined) || []
  const openTasks = projectTasks.filter((t) => t.status !== 'done')

  // Set default project when dialog opens if none chosen
  React.useEffect(() => {
    if (open) {
      setErrorMessage(null)
      setTitle(initialTitle ?? '')
      setObjective('')
      setTaskId(initialTaskId || 'none')
      if (initialProjectId) {
        setProjectId(initialProjectId)
      } else if (firstActiveProjectId) {
        setProjectId((prev) => prev || firstActiveProjectId)
      }
    }
  }, [open, initialProjectId, initialTaskId, initialTitle, firstActiveProjectId])

  // Update default title when project changes if user hasn't typed custom title
  const selectedProject = allProjects.find((p) => p.id === projectId)

  React.useEffect(() => {
    if (selectedProject) {
      setTitle((prev) =>
        !prev || prev.startsWith('Session — ')
          ? `Session — ${selectedProject.name}`
          : prev
      )
    }
  }, [selectedProject])

  const handleProjectChange = (id: string) => {
    setProjectId(id)
    setTaskId('none')
    const proj = allProjects.find((p) => p.id === id)
    if (proj) {
      setTitle(`Session — ${proj.name}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) {
      setErrorMessage(t('sessions.dialogs.projectRequired'))
      return
    }
    if (!title.trim()) {
      setErrorMessage(t('sessions.dialogs.titleRequired'))
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await start(projectId, {
        title: title.trim(),
        taskId: taskId && taskId !== 'none' ? taskId : undefined,
        objective: objective.trim() || undefined,
        scheduledBlockId,
      })
      onOpenChange(false)
      // Reset form
      setTitle('')
      setObjective('')
      setTaskId('none')
    } catch (err) {
      setErrorMessage(
        err instanceof SessionError && err.code === 'WORK_BLOCK_NOT_PLANNED'
          ? t('sessions.dialogs.blockNotPlanned')
          : t('sessions.dialogs.startFailed')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeProjectOfSession = activeSession
    ? allProjects.find((p) => p.id === activeSession.projectId)
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#141412] border-[#242420] text-[#eceeed]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8a9e6b]/15 text-[#8a9e6b] border border-[#8a9e6b]/20">
                <Timer className="h-4 w-4" />
              </div>
              <DialogTitle className="font-serif text-lg text-[#eceeed]">
                {t('sessions.dialogs.startTitle')}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#9ca3af]">
              {t('sessions.dialogs.startDesc')}
            </DialogDescription>
          </DialogHeader>

          {/* Warning if a session is already active */}
          {activeSession && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-[#eceeed] leading-relaxed">
                  <span className="font-semibold text-amber-400">
                    {t('sessions.dialogs.activeSessionInProgress')}
                  </span>{' '}
                  <span className="font-medium text-[#eceeed]">
                    {activeSession.title}
                  </span>{' '}
                  ({activeProjectOfSession?.name || 'Project'},{' '}
                  <span className="capitalize text-amber-400 font-mono font-medium">
                    {activeSession.status}
                  </span>
                  ).
                </div>
              </div>
              <p className="text-[11px] text-[#9ca3af] pl-6">{t('sessions.dialogs.singleSessionPolicy')}</p>
              <div className="pl-6 pt-1">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false)
                    navigate('/sessions')
                  }}
                  className="gap-1 text-xs border-[#2e2e28] bg-[#1a1a17] text-[#eceeed]"
                >
                  <span>{t('sessions.dialogs.viewActiveSession')}</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 text-xs">
              {errorMessage}
            </div>
          )}

          {!activeSession && (
            <>
              {/* Project Picker */}
              <div className="space-y-1.5">
                <label id="start-session-project-label" className="text-xs font-medium text-[#9ca3af]">
                  {t('sessions.dialogs.targetProject')} <span className="text-red-400">*</span>
                </label>
                {activeProjects.length > 0 ? (
                  <Select value={projectId} onValueChange={handleProjectChange}>
                    <SelectTrigger id="start-session-project" aria-labelledby="start-session-project-label" className="bg-[#0e0e0d] border-[#242420] text-[#eceeed]">
                      <SelectValue placeholder={t('sessions.dialogs.selectProject')} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141412] border-[#242420] text-[#eceeed]">
                      {activeProjects.map((proj) => (
                        <SelectItem key={proj.id} value={proj.id}>
                          <div className="flex items-center gap-2">
                            <span>{proj.icon || '📁'}</span>
                            <span className="font-mono text-[10px] text-[#8a9e6b] font-medium">
                              {proj.identifier}
                            </span>
                            <span className="font-medium text-[#eceeed] truncate">
                              {proj.name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xs text-[#6b7280] p-2.5 rounded-lg border border-[#242420] bg-[#0e0e0d]">
                    {t('sessions.dialogs.noProjects')}
                  </div>
                )}
              </div>

              {/* Session Title */}
              <div className="space-y-1.5">
                <label htmlFor="start-session-title" className="text-xs font-medium text-[#9ca3af]">
                  {t('sessions.dialogs.sessionTitle')} <span className="text-red-400">*</span>
                </label>
                <Input
                  id="start-session-title"
                  name="title"
                  placeholder={t('sessions.dialogs.sessionTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-[#0e0e0d] border-[#242420] text-[#eceeed] focus-visible:border-[#8a9e6b]"
                  required
                />
              </div>

              {/* Related Task Selection (Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label id="start-session-task-label" className="text-xs font-medium text-[#9ca3af]">
                    {t('sessions.dialogs.focusTask')} <span className="text-[#6b7280]">({t('sessions.dialogs.optional')})</span>
                  </label>
                  {openTasks.length > 0 && (
                    <span className="text-[10px] text-[#8a9e6b] font-mono">
                      {t('sessions.dialogs.openTasksCount', { count: openTasks.length })}
                    </span>
                  )}
                </div>
                <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
                  <SelectTrigger id="start-session-task" aria-labelledby="start-session-task-label" className="bg-[#0e0e0d] border-[#242420] text-[#eceeed]">
                    <SelectValue placeholder={t('sessions.dialogs.generalProjectWork')} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141412] border-[#242420] text-[#eceeed]">
                    <SelectItem value="none">
                      <span className="text-[#6b7280]">{t('sessions.dialogs.generalProjectWork')}</span>
                    </SelectItem>
                    {openTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2 truncate">
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#8a9e6b] shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Current Objective (Optional) */}
              <div className="space-y-1.5">
                <label htmlFor="start-session-objective" className="text-xs font-medium text-[#9ca3af]">
                  {t('sessions.dialogs.immediateObjective')} <span className="text-[#6b7280]">({t('sessions.dialogs.optional')})</span>
                </label>
                <Textarea
                  id="start-session-objective"
                  name="objective"
                  placeholder={t('sessions.dialogs.objectivePlaceholder')}
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="bg-[#0e0e0d] border-[#242420] text-[#eceeed] focus-visible:border-[#8a9e6b]"
                />
              </div>
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#242420]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-[#9ca3af] hover:text-[#eceeed]"
            >
              {t('sessions.dialogs.cancel')}
            </Button>
            {!activeSession && (
              <Button
                type="submit"
                variant="olive"
                disabled={!projectId || !title.trim() || isSubmitting}
                className="gap-1.5 shadow-sm"
              >
                <Timer className="h-3.5 w-3.5" />
                <span>{isSubmitting ? t('sessions.dialogs.starting') : t('sessions.dialogs.startFocus')}</span>
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
