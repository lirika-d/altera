import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Edit2,
  Check,
  X,
  Target,
  FolderPlus,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useProjects } from '@/hooks/useProjects'
import { useAppStore } from '@/store/useAppStore'
import { updateProject, deleteProject } from '@/db/db'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityIcon } from '@/components/shared/PriorityIcon'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Project, ProjectFilter } from '@/types'
import { cn } from '@/lib/utils'
import { CreateProjectFromTemplateDialog } from '@/components/settings/CreateProjectFromTemplateDialog'

export function Projects() {
  const { t, tx } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = React.useState(false)
  const templateIntent = searchParams.get('action') === 'create-from-template'
  const templateIntentId = searchParams.get('template') || undefined
  const {
    projectFilter,
    setProjectFilter,
    projectSearchQuery,
    setProjectSearchQuery,
    setIsCreateProjectOpen,
  } = useAppStore()

  const projects = useProjects(projectFilter, projectSearchQuery) || []

  const handleTemplateDialogOpenChange = (open: boolean) => {
    setIsTemplateDialogOpen(open)
    if (!open && templateIntent) {
      const next = new URLSearchParams(searchParams)
      next.delete('action')
      next.delete('template')
      setSearchParams(next, { replace: true })
    }
  }

  // Inline editing state: projectId -> { name: string, nextAction: string }
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editNextAction, setEditNextAction] = React.useState('')

  // Delete confirmation state
  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const filterTabs: { id: ProjectFilter; label: string }[] = [
    { id: 'all', label: t('projects.filters.all') },
    { id: 'active', label: t('projects.filters.active') },
    { id: 'backlog', label: t('projects.filters.backlog') },
    { id: 'paused', label: t('projects.filters.paused') },
    { id: 'completed', label: t('projects.filters.completed') },
    { id: 'archived', label: t('projects.filters.archived') },
  ]

  const handleStartEdit = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(proj.id)
    setEditName(proj.name)
    setEditNextAction(proj.nextAction)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
  }

  const handleSaveEdit = async (projId: string) => {
    if (!editName.trim()) return
    await updateProject(projId, {
      name: editName.trim(),
      nextAction: editNextAction.trim(),
    })
    setEditingId(null)
  }

  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      setDeleteError(null)
      try {
        await deleteProject(projectToDelete.id)
        setProjectToDelete(null)
      } catch {
        console.error('Project deletion failed')
        setDeleteError(t('projects.deleteFailed'))
      }
    }
  }

  return (
    <div className="px-5 py-5 md:px-7 md:py-6 max-w-7xl mx-auto space-y-5">
      {/* ─── Page Header (Stitch Editorial Style) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl md:text-[28px] font-normal text-text-primary tracking-tight">
              {t('projects.title')}
            </h1>
            <span className="font-mono text-[10px] text-text-muted px-2 py-0.5 rounded-full bg-bg-surface border border-border-subtle">
              {projects.length}
            </span>
          </div>
          <p className="text-[13px] text-text-secondary">
            {t('projects.subtitle')}
          </p>
        </div>

        <Button
          size="sm"
          variant="olive"
          onClick={() => setIsCreateProjectOpen(true)}
          className="gap-1.5 self-start sm:self-auto h-8 px-3 text-xs shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t('projects.newProject')}</span>
        </Button>
      </div>

      {/* ─── Filter Pills and Search Bar ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setProjectFilter(tab.id)}
              className={cn(
                'h-7 px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                projectFilter === tab.id
                  ? 'bg-bg-elevated text-text-primary border border-border/80 shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <Input
            value={projectSearchQuery}
            onChange={(e) => setProjectSearchQuery(e.target.value)}
            aria-label={t('projects.searchPlaceholder')}
            placeholder={t('projects.searchPlaceholder')}
            className="pl-8 pr-7 h-8 text-xs bg-bg-surface border-border-subtle focus-visible:border-accent-olive/70"
          />
          {projectSearchQuery && (
            <button
              onClick={() => setProjectSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Project Table / List ─── */}
      <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] border-b border-border-subtle bg-bg-elevated/40">
          <div className="col-span-2">{t('projects.tableHeader.id')}</div>
          <div className="col-span-3">{t('projects.tableHeader.name')}</div>
          <div className="col-span-2">{t('projects.tableHeader.status')}</div>
          <div className="col-span-3">{t('projects.tableHeader.nextAction')}</div>
          <div className="col-span-1">{t('projects.tableHeader.progress')}</div>
          <div className="col-span-1 text-right">{t('projects.tableHeader.actions')}</div>
        </div>

        {/* Rows */}
        {projects.length > 0 ? (
          <div className="divide-y divide-border-subtle">
            {projects.map((project) => {
              const isEditing = editingId === project.id

              if (isEditing) {
                return (
                  <div
                    key={project.id}
                    className="p-4 bg-bg-elevated/70 border-l-2 border-accent-olive space-y-3 text-xs"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-text-muted uppercase font-semibold">
                          {t('projects.inlineEdit.projectName')}
                        </label>
                        <Input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-xs mt-1 bg-bg-base border-border"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-text-muted uppercase font-semibold">
                          {t('projects.inlineEdit.nextAction')}
                        </label>
                        <Input
                          value={editNextAction}
                          onChange={(e) => setEditNextAction(e.target.value)}
                          className="h-8 text-xs mt-1 bg-bg-base border-border"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="gap-1 h-7"
                      >
                        <X className="h-3 w-3" /> {t('projects.inlineEdit.cancel')}
                      </Button>
                      <Button
                        size="xs"
                        variant="olive"
                        onClick={() => handleSaveEdit(project.id)}
                        className="gap-1 h-7"
                      >
                        <Check className="h-3 w-3" /> {t('projects.inlineEdit.save')}
                      </Button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={project.id}
                  className="group grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-bg-elevated/40 transition-colors text-[13px] cursor-pointer"
                  onClick={() => {
                    window.location.hash = `#/projects/${project.id}`
                  }}
                >
                  {/* Monospace Identifier */}
                  <div className="col-span-2 flex items-center gap-2 min-w-0">
                    <span className="text-sm shrink-0" aria-hidden="true">{project.icon || '📁'}</span>
                    <span className="font-mono text-xs font-semibold text-accent-olive tracking-wide whitespace-nowrap">
                      {project.identifier}
                    </span>
                  </div>

                  {/* Name & Priority */}
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <PriorityIcon priority={project.priority} />
                    <Link
                      to={`/projects/${project.id}`}
                      className="font-medium text-text-primary hover:text-accent-olive transition-colors truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {project.name}
                    </Link>
                  </div>

                  {/* Status Badge */}
                  <div className="col-span-2">
                    <StatusBadge status={project.status} />
                  </div>

                  {/* Next Action snippet */}
                  <div className="col-span-3 flex items-center gap-1.5 text-text-muted truncate">
                    <Target className="h-3 w-3 text-accent-olive/70 shrink-0" />
                    <span className="truncate text-xs text-text-secondary">
                      {project.nextAction || '—'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="col-span-1">
                    <ProgressBar
                      progress={project.progress}
                      showPercentage
                      size="sm"
                    />
                  </div>

                  {/* Row Actions */}
                  <div
                    className="col-span-1 flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-7 w-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                          title={tx("Actions")}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-bg-surface border-border">
                        <DropdownMenuItem asChild>
                          <Link
                            to={`/projects/${project.id}`}
                            className="flex items-center gap-2 cursor-pointer text-xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>{t('projects.actions.open')}</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleStartEdit(project, e)}
                          className="flex items-center gap-2 cursor-pointer text-xs"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>{t('projects.actions.edit')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setProjectToDelete(project)}
                          className="flex items-center gap-2 text-accent-red hover:bg-accent-red/10 cursor-pointer text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{t('projects.actions.delete')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={FolderPlus}
            title={
              projectSearchQuery
                ? t('projects.empty.searchTitle', { query: projectSearchQuery })
                : t('projects.empty.filterTitle', { filter: projectFilter })
            }
            description={t('projects.empty.desc')}
            actionLabel={t('projects.empty.action')}
            onAction={() => setIsCreateProjectOpen(true)}
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <CreateProjectFromTemplateDialog key={templateIntentId ?? 'none'} open={isTemplateDialogOpen || templateIntent} templateId={templateIntentId} onOpenChange={handleTemplateDialogOpenChange} />
      <Dialog
        open={!!projectToDelete}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null)
          setDeleteError(null)
        }}
      >
        <DialogContent className="max-w-md bg-bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-text-primary">
              {t('projects.deleteDialog.title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary leading-relaxed pt-1">
              {t('projects.deleteDialog.desc', {
                name: projectToDelete?.name || '',
                id: projectToDelete?.identifier || '',
              })}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-2.5 text-xs text-accent-red">
              {deleteError}
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProjectToDelete(null)}
              className="text-xs"
            >
              {t('projects.deleteDialog.cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              className="text-xs"
            >
              {t('projects.deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
