import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { createProjectFromTemplate } from '@/db/templates'
import { db } from '@/db/db'
import { appRoutes } from '@/lib/appRoutes'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CreateProjectFromTemplateDialogProps {
  open: boolean
  templateId?: string
  onOpenChange: (open: boolean) => void
}

export function CreateProjectFromTemplateDialog({ open, templateId, onOpenChange }: CreateProjectFromTemplateDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const template = useLiveQuery(() => templateId ? db.workflowTemplates.get(templateId) : undefined, [templateId])
  const [projectName, setProjectName] = React.useState('')
  const [projectNameCustomized, setProjectNameCustomized] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const displayedProjectName = projectNameCustomized ? projectName : template?.kind === 'project' ? template.projectName : projectName

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!templateId || template?.kind !== 'project' || !displayedProjectName.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const project = await createProjectFromTemplate(templateId, displayedProjectName.trim())
      onOpenChange(false)
      navigate(appRoutes.project(project.id))
    } catch {
      setError(t('settings.templates.createProjectError'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader><DialogTitle>{t('settings.templates.createProject')}</DialogTitle><DialogDescription>{t('settings.templates.useProjectDescription')}</DialogDescription></DialogHeader>
          {template?.kind === 'project' ? <>
            <div className="space-y-1.5"><label htmlFor="new-project-template-name" className="text-xs text-text-secondary">{t('settings.templates.projectName')}</label><Input id="new-project-template-name" autoFocus value={displayedProjectName} onChange={event => { setProjectName(event.target.value); setProjectNameCustomized(true) }} maxLength={120} required /></div>
            {template.tasks.length > 0 && <p className="text-xs text-text-muted">{t('settings.templates.initialTaskPreview', { count: template.tasks.length })}</p>}
          </> : <p role="alert" className="text-xs text-accent-red">{t('settings.templates.templateMissing')}</p>}
          {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('settings.templates.cancel')}</Button><Button type="submit" disabled={isSaving || template?.kind !== 'project'}>{t(isSaving ? 'settings.templates.saving' : 'settings.templates.createProject')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
