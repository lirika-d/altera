import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Trash2, WandSparkles } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { createWorkflowTemplate, deleteWorkflowTemplate, updateWorkflowTemplate, type NewWorkflowTemplate } from '@/db/templates'
import { useWorkflowTemplates } from '@/hooks/useWorkflowTemplates'
import { appRoutes } from '@/lib/appRoutes'
import type { Priority, WorkflowTemplate } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type EditorKind = WorkflowTemplate['kind']
const priorities: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']

export function WorkflowTemplateSettings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const templates = useWorkflowTemplates()
  const [editorKind, setEditorKind] = React.useState<EditorKind | null>(null)
  const [editing, setEditing] = React.useState<WorkflowTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<WorkflowTemplate | null>(null)
  const [name, setName] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [projectName, setProjectName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [priority, setPriority] = React.useState<Priority>('medium')
  const [icon, setIcon] = React.useState('📁')
  const [color, setColor] = React.useState('#8a9e6b')
  const [nextAction, setNextAction] = React.useState('')
  const [taskLines, setTaskLines] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const beginCreate = (kind: EditorKind) => {
    setEditing(null)
    setEditorKind(kind)
    setName('')
    setTitle('')
    setProjectName('')
    setDescription('')
    setPriority('medium')
    setIcon('📁')
    setColor('#8a9e6b')
    setNextAction('')
    setTaskLines('')
    setError(null)
  }

  const beginEdit = (template: WorkflowTemplate) => {
    setEditing(template)
    setEditorKind(template.kind)
    setName(template.name)
    setPriority(template.priority)
    if (template.kind === 'task') {
      setTitle(template.title)
      setProjectName('')
      setDescription('')
      setIcon('📁')
      setColor('#8a9e6b')
      setNextAction('')
      setTaskLines('')
    } else {
      setTitle('')
      setProjectName(template.projectName)
      setDescription(template.description)
      setIcon(template.icon)
      setColor(template.color)
      setNextAction(template.nextAction)
      setTaskLines(template.tasks.map(task => task.title).join('\n'))
    }
    setError(null)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editorKind) return
    const common = { name, kind: editorKind, priority } as const
    const payload: NewWorkflowTemplate = editorKind === 'task'
      ? { ...common, kind: 'task', title, priority }
      : {
          ...common,
          kind: 'project',
          projectName,
          description,
          priority,
          color,
          icon,
          nextAction,
          tasks: taskLines.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(taskTitle => ({ title: taskTitle, priority })),
        }
    setIsSaving(true)
    setError(null)
    try {
      if (editing) await updateWorkflowTemplate(editing.id, payload)
      else await createWorkflowTemplate(payload)
      setEditorKind(null)
      setEditing(null)
    } catch {
      setError(t('settings.templates.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteWorkflowTemplate(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      setError(t('settings.templates.deleteError'))
    }
  }

  const taskTemplates = templates.filter(template => template.kind === 'task')
  const projectTemplates = templates.filter(template => template.kind === 'project')

  return (
    <section className="space-y-4 rounded-lg border border-border bg-bg-surface p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">{t('settings.templates.title')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{t('settings.templates.description')}</p>
      </div>
      {(['task', 'project'] as const).map(kind => {
        const items = kind === 'task' ? taskTemplates : projectTemplates
        return (
          <div key={kind} className="space-y-2 border-t border-border-subtle pt-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-medium text-text-primary">{t(`settings.templates.${kind}Templates`)}</h3>
              <Button variant="outline" size="sm" onClick={() => beginCreate(kind)}><Plus className="h-3.5 w-3.5" />{t('settings.templates.new')}</Button>
            </div>
            {items.length ? <ul className="space-y-2">
              {items.map(template => (
                <li key={template.id} className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-base/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-text-primary">{template.name}</p>
                    <p className="truncate text-[11px] text-text-muted">{template.kind === 'task' ? template.title : `${template.projectName} · ${template.tasks.length} ${t('settings.templates.tasksCount')}`}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button variant="olive" size="xs" onClick={() => navigate(template.kind === 'task' ? appRoutes.createTask(template.id) : appRoutes.createProjectFromTemplate(template.id))}>
                      <WandSparkles className="h-3 w-3" />{t('settings.templates.use')}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={t('settings.templates.edit', { name: template.name })} onClick={() => beginEdit(template)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" aria-label={t('settings.templates.delete', { name: template.name })} onClick={() => setDeleteTarget(template)}><Trash2 className="h-3.5 w-3.5 text-accent-red" /></Button>
                  </div>
                </li>
              ))}
            </ul> : <p className="text-xs text-text-muted">{t('settings.templates.empty')}</p>}
          </div>
        )
      })}

      <Dialog open={editorKind !== null} onOpenChange={open => { if (!open) setEditorKind(null) }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t(editing ? 'settings.templates.editTitle' : 'settings.templates.createTitle')}</DialogTitle>
              <DialogDescription>{t(editorKind === 'project' ? 'settings.templates.projectDescription' : 'settings.templates.taskDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5"><label htmlFor="workflow-template-name" className="text-xs text-text-secondary">{t('settings.templates.name')}</label><Input id="workflow-template-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} required /></div>
            {editorKind === 'task' ? (
              <div className="space-y-1.5"><label htmlFor="workflow-template-task-title" className="text-xs text-text-secondary">{t('settings.templates.taskTitle')}</label><Input id="workflow-template-task-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required /></div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><label htmlFor="workflow-template-project-name" className="text-xs text-text-secondary">{t('settings.templates.projectName')}</label><Input id="workflow-template-project-name" value={projectName} onChange={event => setProjectName(event.target.value)} maxLength={120} required /></div>
                  <div className="space-y-1.5"><label htmlFor="workflow-template-icon" className="text-xs text-text-secondary">{t('settings.templates.icon')}</label><Input id="workflow-template-icon" value={icon} onChange={event => setIcon(event.target.value)} maxLength={12} required /></div>
                </div>
                <div className="space-y-1.5"><label htmlFor="workflow-template-description" className="text-xs text-text-secondary">{t('settings.templates.projectDetails')}</label><Textarea id="workflow-template-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={2000} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><label htmlFor="workflow-template-color" className="text-xs text-text-secondary">{t('settings.templates.color')}</label><Input id="workflow-template-color" type="color" value={color} onChange={event => setColor(event.target.value)} className="px-1.5" /></div>
                  <div className="space-y-1.5"><label htmlFor="workflow-template-next-action" className="text-xs text-text-secondary">{t('settings.templates.nextAction')}</label><Input id="workflow-template-next-action" value={nextAction} onChange={event => setNextAction(event.target.value)} maxLength={300} /></div>
                </div>
                <div className="space-y-1.5"><label htmlFor="workflow-template-tasks" className="text-xs text-text-secondary">{t('settings.templates.initialTasks')}</label><Textarea id="workflow-template-tasks" value={taskLines} onChange={event => setTaskLines(event.target.value)} placeholder={t('settings.templates.initialTasksPlaceholder')} /></div>
              </>
            )}
            <div className="space-y-1.5"><label htmlFor="workflow-template-priority" className="text-xs text-text-secondary">{t('settings.templates.priority')}</label>
              <Select value={priority} onValueChange={value => setPriority(value as Priority)}><SelectTrigger id="workflow-template-priority"><SelectValue /></SelectTrigger><SelectContent>{priorities.map(value => <SelectItem key={value} value={value}>{t(`tasks.priority.${value}`)}</SelectItem>)}</SelectContent></Select>
            </div>
            {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setEditorKind(null)}>{t('settings.templates.cancel')}</Button><Button type="submit" disabled={isSaving}>{t(isSaving ? 'settings.templates.saving' : 'settings.templates.save')}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('settings.templates.deleteTitle')}</DialogTitle><DialogDescription>{t('settings.templates.deleteDescription', { name: deleteTarget?.name ?? '' })}</DialogDescription></DialogHeader>
          {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
          <DialogFooter><Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t('settings.templates.cancel')}</Button><Button variant="danger" onClick={handleDelete}>{t('settings.templates.deleteConfirm')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
