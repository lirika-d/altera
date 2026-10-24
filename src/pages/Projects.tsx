import * as React from 'react'
import { Link } from 'react-router-dom'
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

export function Projects() {
  const {
    projectFilter,
    setProjectFilter,
    projectSearchQuery,
    setProjectSearchQuery,
    setIsCreateProjectOpen,
  } = useAppStore()

  const projects = useProjects(projectFilter, projectSearchQuery) || []

  // Inline editing state: projectId -> { name: string, nextAction: string }
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editNextAction, setEditNextAction] = React.useState('')

  // Delete confirmation state
  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const filterTabs: { id: ProjectFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'paused', label: 'Paused' },
    { id: 'completed', label: 'Completed' },
    { id: 'archived', label: 'Archived' },
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
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : 'Failed to delete project')
      }
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-text-primary">Projects</h1>
            <span className="font-mono text-[11px] text-text-muted px-2 py-0.5 rounded-full bg-bg-surface border border-border">
              {projects.length}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage your workspace roadmap, key next actions, and progress.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreateProjectOpen(true)}
          className="gap-1.5 self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Project</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setProjectFilter(tab.id)}
              className={cn(
                'h-7 px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                projectFilter === tab.id
                  ? 'bg-bg-elevated text-text-primary border border-border shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <Input
            value={projectSearchQuery}
            onChange={(e) => setProjectSearchQuery(e.target.value)}
            placeholder="Search projects or actions..."
            className="pl-8 h-8 text-xs bg-bg-surface"
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

      {/* Project Table / List */}
      <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider border-b border-border-subtle bg-bg-elevated/40">
          <div className="col-span-2">ID</div>
          <div className="col-span-3">Project Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Next Action</div>
          <div className="col-span-1">Progress</div>
          <div className="col-span-1 text-right">Actions</div>
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
                    className="p-3 bg-bg-elevated/70 border-l-2 border-accent-blue space-y-2 text-xs"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-text-muted uppercase font-semibold">
                          Project Name
                        </label>
                        <Input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-text-muted uppercase font-semibold">
                          Next Action
                        </label>
                        <Input
                          value={editNextAction}
                          onChange={(e) => setEditNextAction(e.target.value)}
                          className="h-7 text-xs mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="gap-1"
                      >
                        <X className="h-3 w-3" /> Cancel
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => handleSaveEdit(project.id)}
                        className="gap-1"
                      >
                        <Check className="h-3 w-3" /> Save Changes
                      </Button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={project.id}
                  className="group grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-bg-elevated transition-colors text-xs cursor-pointer"
                  onClick={() => {
                    // Navigate to project
                    window.location.hash = `#/projects/${project.id}`
                  }}
                >
                  {/* Monospace Identifier */}
                  <div className="col-span-2 flex items-center gap-2 min-w-0">
                    <span className="text-sm shrink-0">{project.icon || '📁'}</span>
                    <span className="font-mono text-[11px] font-semibold text-text-secondary tracking-wider whitespace-nowrap">
                      {project.identifier}
                    </span>
                  </div>

                  {/* Name & Priority */}
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <PriorityIcon priority={project.priority} />
                    <Link
                      to={`/projects/${project.id}`}
                      className="font-medium text-text-primary hover:text-accent-blue transition-colors truncate"
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
                    <Target className="h-3 w-3 text-accent-blue shrink-0" />
                    <span className="truncate text-[11px] text-text-secondary">
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
                          title="Actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem asChild>
                          <Link
                            to={`/projects/${project.id}`}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Open Workspace</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleStartEdit(project, e)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Inline Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setProjectToDelete(project)}
                          className="flex items-center gap-2 text-accent-red hover:bg-accent-red/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
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
                ? `No projects matching "${projectSearchQuery}"`
                : `No ${projectFilter !== 'all' ? projectFilter : ''} projects found`
            }
            description="Create a new project to start tracking your next actions."
            actionLabel="Create Project"
            onAction={() => setIsCreateProjectOpen(true)}
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!projectToDelete}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null)
          setDeleteError(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-text-primary">
                "{projectToDelete?.name}" ({projectToDelete?.identifier})
              </span>
              ? This will permanently remove the project, all its tasks, and associated activity history.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-2.5 text-xs text-accent-red">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setProjectToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
            >
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
