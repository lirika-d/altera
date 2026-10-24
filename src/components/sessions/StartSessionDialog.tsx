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
import { Timer, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

interface StartSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProjectId?: string
}

export function StartSessionDialog({
  open,
  onOpenChange,
  initialProjectId,
}: StartSessionDialogProps) {
  const navigate = useNavigate()
  const allProjects = useProjects() || []
  const activeProjects = allProjects.filter((p) => p.status !== 'archived')
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
      if (initialProjectId) {
        setProjectId(initialProjectId)
      } else if (activeProjects.length > 0) {
        setProjectId((prev) => prev || activeProjects[0].id)
      }
    }
  }, [open, initialProjectId, activeProjects])

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
      setErrorMessage('Please select a project for this session.')
      return
    }
    if (!title.trim()) {
      setErrorMessage('Please provide a session title.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await start(projectId, {
        title: title.trim(),
        taskId: taskId && taskId !== 'none' ? taskId : undefined,
        objective: objective.trim() || undefined,
      })
      onOpenChange(false)
      // Reset form
      setTitle('')
      setObjective('')
      setTaskId('none')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start session'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeProjectOfSession = activeSession
    ? allProjects.find((p) => p.id === activeSession.projectId)
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-blue/15 text-accent-blue border border-accent-blue/20">
                <Timer className="h-3.5 w-3.5" />
              </div>
              <DialogTitle>Start Work Session</DialogTitle>
            </div>
            <DialogDescription>
              Launch a focused, distraction-free work block linked to a project.
            </DialogDescription>
          </DialogHeader>

          {/* Warning if a session is already active */}
          {activeSession && (
            <div className="p-3 rounded-lg border border-accent-amber/30 bg-accent-amber/10 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-accent-amber shrink-0 mt-0.5" />
                <div className="text-xs text-text-primary leading-relaxed">
                  <span className="font-semibold text-accent-amber">
                    Active session in progress:
                  </span>{' '}
                  <span className="font-medium text-text-primary">
                    {activeSession.title}
                  </span>{' '}
                  ({activeProjectOfSession?.name || 'Project'},{' '}
                  <span className="capitalize text-accent-amber font-mono font-medium">
                    {activeSession.status}
                  </span>
                  ).
                </div>
              </div>
              <p className="text-[11px] text-text-secondary pl-6">
                ALTERA enforces single-session focus to prevent fragmented tracking.
                Finish or resume your current session before starting a new one.
              </p>
              <div className="pl-6 pt-1">
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    onOpenChange(false)
                    navigate('/sessions')
                  }}
                  className="gap-1 text-[11px]"
                >
                  <span>View Active Session</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-md border border-accent-red/30 bg-accent-red/10 text-accent-red text-xs">
              {errorMessage}
            </div>
          )}

          {!activeSession && (
            <>
              {/* Project Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-text-secondary">
                  Target Project <span className="text-accent-red">*</span>
                </label>
                {activeProjects.length > 0 ? (
                  <Select value={projectId} onValueChange={handleProjectChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProjects.map((proj) => (
                        <SelectItem key={proj.id} value={proj.id}>
                          <div className="flex items-center gap-2">
                            <span>{proj.icon || '📁'}</span>
                            <span className="font-mono text-[10px] text-text-muted">
                              {proj.identifier}
                            </span>
                            <span className="font-medium text-text-primary truncate">
                              {proj.name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xs text-text-muted p-2 rounded border border-border-subtle bg-bg-base">
                    No projects available. Create a project first.
                  </div>
                )}
              </div>

              {/* Session Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-text-secondary">
                  Session Title <span className="text-accent-red">*</span>
                </label>
                <Input
                  placeholder="e.g. Core Engine Performance Sprint"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Related Task Selection (Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-text-secondary">
                    Focus Task <span className="text-text-muted">(Optional)</span>
                  </label>
                  {openTasks.length > 0 && (
                    <span className="text-[10px] text-text-muted font-mono">
                      {openTasks.length} open
                    </span>
                  )}
                </div>
                <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None (General Project Work)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-text-muted">None (General Project Work)</span>
                    </SelectItem>
                    {openTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2 truncate">
                          <CheckCircle2 className="h-3 w-3 text-text-muted shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Current Objective (Optional) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-text-secondary">
                  Immediate Objective <span className="text-text-muted">(Optional)</span>
                </label>
                <Textarea
                  placeholder="What is the concrete goal for this focus block?"
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {!activeSession && (
              <Button
                type="submit"
                disabled={!projectId || !title.trim() || isSubmitting}
                className="gap-1.5 shadow-sm"
              >
                <Timer className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Starting…' : 'Start Focus Session'}</span>
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
