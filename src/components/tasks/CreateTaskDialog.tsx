import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask } from '@/db/db'
import { useProjects } from '@/hooks/useProjects'
import { useWorkflowTemplates } from '@/hooks/useWorkflowTemplates'
import { useTranslation } from '@/i18n'
import type { Priority, Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTemplateId?: string
}

const EMPTY_PROJECTS: Project[] = []

export function CreateTaskDialog({ open, onOpenChange, initialTemplateId }: CreateTaskDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const projects = useProjects('active') ?? EMPTY_PROJECTS
  const templates = useWorkflowTemplates('task')
  const [projectId, setProjectId] = React.useState('')
  const [templateId, setTemplateId] = React.useState(initialTemplateId ?? '')
  const [title, setTitle] = React.useState('')
  const [titleCustomized, setTitleCustomized] = React.useState(false)
  const [priority, setPriority] = React.useState<Priority>('medium')
  const [priorityCustomized, setPriorityCustomized] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const activeProjectId = projects.some(project => project.id === projectId) ? projectId : projects[0]?.id ?? ''
  const foundTemplate = templates.find(item => item.id === templateId)
  const selectedTemplate = foundTemplate?.kind === 'task' ? foundTemplate : undefined
  const displayedTitle = titleCustomized ? title : selectedTemplate?.title ?? title
  const displayedPriority = priorityCustomized ? priority : selectedTemplate?.priority ?? priority

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setTemplateId('')
      setTitle('')
      setTitleCustomized(false)
      setPriority('medium')
      setPriorityCustomized(false)
      setError(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeProjectId || !displayedTitle.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      await createTask({ projectId: activeProjectId, title: displayedTitle.trim(), priority: displayedPriority, status: 'todo' })
      handleOpenChange(false)
    } catch {
      setError(t('tasks.create.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader><DialogTitle>{t('tasks.create.title')}</DialogTitle><DialogDescription>{t('tasks.create.description')}</DialogDescription></DialogHeader>
          {templates.length > 0 && <div className="space-y-1.5">
            <label htmlFor="task-template-select" className="text-xs text-text-secondary">{t('tasks.create.template')}</label>
            <Select value={templateId || 'none'} onValueChange={value => { setTemplateId(value === 'none' ? '' : value); setTitleCustomized(false); setPriorityCustomized(false); setTitle(''); setPriority('medium') }}>
              <SelectTrigger id="task-template-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">{t('tasks.create.noTemplate')}</SelectItem>{templates.map(template => template.kind === 'task' ? <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem> : null)}</SelectContent>
            </Select>
          </div>}
          <div className="space-y-1.5"><label htmlFor="task-project-select" className="text-xs text-text-secondary">{t('tasks.create.project')}</label>
            {projects.length ? <Select value={activeProjectId} onValueChange={setProjectId}><SelectTrigger id="task-project-select"><SelectValue placeholder={t('tasks.create.chooseProject')} /></SelectTrigger><SelectContent>{projects.map(project => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select> : <div className="space-y-2 rounded border border-border-subtle p-3"><p className="text-xs text-text-muted">{t('tasks.create.noProjects')}</p><Button type="button" size="sm" variant="outline" onClick={() => { handleOpenChange(false); navigate('/projects') }}>{t('tasks.create.openProjects')}</Button></div>}
          </div>
          <div className="space-y-1.5"><label htmlFor="task-title" className="text-xs text-text-secondary">{t('tasks.create.taskTitle')}</label><Input id="task-title" value={displayedTitle} onChange={event => { setTitle(event.target.value); setTitleCustomized(true) }} maxLength={160} required /></div>
          <div className="space-y-1.5"><label htmlFor="task-priority" className="text-xs text-text-secondary">{t('tasks.create.priority')}</label>
            <Select value={displayedPriority} onValueChange={value => { setPriority(value as Priority); setPriorityCustomized(true) }}><SelectTrigger id="task-priority"><SelectValue /></SelectTrigger><SelectContent>{(['urgent', 'high', 'medium', 'low', 'none'] as const).map(value => <SelectItem key={value} value={value}>{t(`tasks.priority.${value}`)}</SelectItem>)}</SelectContent></Select>
          </div>
          {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>{t('tasks.create.cancel')}</Button><Button type="submit" disabled={isSaving || !projects.length}>{t(isSaving ? 'tasks.create.saving' : 'tasks.create.create')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
