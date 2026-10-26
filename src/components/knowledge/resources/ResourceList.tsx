import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Resource, ResourceType } from '@/types'
import { db } from '@/db/db'
import {
  Globe,
  Code,
  FileText,
  Star,
  Search,
  Plus,
  Trash2,
  X,
  LayoutGrid,
  List as ListIcon,
  Tag as TagIcon,
  FolderGit2,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { useResources, useTags, useKnowledgeActions } from '@/hooks/useKnowledge'
import { useProjects } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import { ResourceCard } from './ResourceCard'
import { CreateResourceDialog } from './CreateResourceDialog'
import { EditResourceDialog } from './EditResourceDialog'
import { ResourceDetailModal } from './ResourceDetailModal'
import { useTranslation } from '@/i18n'

export interface ResourceListProps {
  /** Optional project scope */
  projectId?: string
  /** Whether to show the top header and title bar */
  showHeader?: boolean
  /** Optional extra classes */
  className?: string
  /** Callback when resource is selected */
  onSelectResource?: (resource: Resource) => void
  /** Resource id selected through a stable Knowledge Hub URL. */
  selectedResourceId?: string
  /** Clears a missing/deleted or dismissed URL selection. */
  onClearSelectedResource?: () => void
}

export function ResourceList({
  projectId: fixedProjectId,
  showHeader = true,
  className,
  onSelectResource,
  selectedResourceId,
  onClearSelectedResource,
}: ResourceListProps) {
  const { tx } = useTranslation()
  const { softDeleteResource } = useKnowledgeActions()
  const projects = useProjects() || []
  const availableTags = useTags() || []

  // Filter States
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedType, setSelectedType] = React.useState<'all' | ResourceType>('all')
  const [onlyFavorites, setOnlyFavorites] = React.useState(false)
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(
    fixedProjectId || 'all'
  )
  const [selectedTagId, setSelectedTagId] = React.useState<string>('all')
  const [showTrash, setShowTrash] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [detailResource, setDetailResource] = React.useState<Resource | null>(null)
  const [editResource, setEditResource] = React.useState<Resource | null>(null)

  const routedResource = useLiveQuery(async () => {
    if (!selectedResourceId) return null
    return (await db.resources.get(selectedResourceId)) ?? null
  }, [selectedResourceId])

  React.useEffect(() => {
    if (!selectedResourceId || routedResource === undefined) return
    if (routedResource && routedResource.id !== selectedResourceId) return
    if (!routedResource || routedResource.deletedAt) onClearSelectedResource?.()
  }, [onClearSelectedResource, routedResource, selectedResourceId])

  const routeDetailResource = selectedResourceId && routedResource?.id === selectedResourceId && !routedResource.deletedAt
    ? routedResource
    : null
  const visibleDetailResource = detailResource ?? routeDetailResource

  // Query resources based on active filters
  const effectiveProjectId =
    fixedProjectId || (selectedProjectId !== 'all' ? selectedProjectId : undefined)
  const effectiveTagId = selectedTagId !== 'all' ? selectedTagId : undefined
  const effectiveType = selectedType !== 'all' ? selectedType : undefined

  // Active resources list (dexie live query)
  const resources = useResources({
    projectId: effectiveProjectId,
    type: effectiveType,
    tagId: effectiveTagId,
    isFavorite: onlyFavorites ? true : undefined,
    showTrash,
    search: searchQuery.trim() || undefined,
  })

  // Also query unfiltered resources for type counts
  const allCurrentResources = useResources({
    projectId: effectiveProjectId,
    showTrash,
  })

  const linkCount = allCurrentResources.filter((r) => r.type === 'link').length
  const snippetCount = allCurrentResources.filter((r) => r.type === 'snippet').length
  const fileCount = allCurrentResources.filter((r) => r.type === 'file').length
  const totalCount = allCurrentResources.length

  // Quick reset filters
  const resetFilters = () => {
    setSearchQuery('')
    setSelectedType('all')
    setOnlyFavorites(false)
    if (!fixedProjectId) setSelectedProjectId('all')
    setSelectedTagId('all')
    setShowTrash(false)
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedType !== 'all' ||
    onlyFavorites ||
    (!fixedProjectId && selectedProjectId !== 'all') ||
    selectedTagId !== 'all' ||
    showTrash

  const handleCardSelect = (resource: Resource) => {
    setDetailResource(resource)
    onSelectResource?.(resource)
  }

  const handleCardEdit = (resource: Resource) => {
    setEditResource(resource)
  }

  const handleCardDelete = async (resource: Resource) => {
    try {
      await softDeleteResource(resource.id)
    } catch (err) {
      console.error('Failed to soft delete resource:', err)
    }
  }

  return (
    <div className={cn('flex flex-col space-y-4', className)}>
      {/* Top Header */}
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary tracking-tight">
                {tx("Resources Library")}</h2>
              <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs font-mono font-medium text-text-secondary border border-border">
                {resources.length}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {tx("Curate documentation links, code snippets, and reference files.")}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{tx("New Resource")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-bg-surface p-3">
        {/* Row 1: Type Segmented Pills & Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          {/* Segmented Type Pills */}
          <div className="inline-flex rounded-md border border-border bg-bg-base p-0.5 self-start overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setSelectedType('all')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all select-none whitespace-nowrap',
                selectedType === 'all'
                  ? 'bg-bg-elevated text-text-primary shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{tx("All")}</span>
              <span className="text-[10px] opacity-60 font-mono">({totalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('link')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all select-none whitespace-nowrap',
                selectedType === 'link'
                  ? 'bg-bg-elevated text-accent-blue shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Globe className="h-3.5 w-3.5 text-accent-blue" />
              <span>{tx("Links")}</span>
              <span className="text-[10px] opacity-60 font-mono">({linkCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('snippet')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all select-none whitespace-nowrap',
                selectedType === 'snippet'
                  ? 'bg-bg-elevated text-accent-purple shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Code className="h-3.5 w-3.5 text-accent-purple" />
              <span>{tx("Snippets")}</span>
              <span className="text-[10px] opacity-60 font-mono">({snippetCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('file')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-all select-none whitespace-nowrap',
                selectedType === 'file'
                  ? 'bg-bg-elevated text-accent-amber shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <FileText className="h-3.5 w-3.5 text-accent-amber" />
              <span>{tx("Files")}</span>
              <span className="text-[10px] opacity-60 font-mono">({fileCount})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-text-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tx("Search resources, URLs, code...")}
              className="pl-8 pr-7 h-8 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-text-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Dropdowns & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border-subtle/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Favorites Toggle */}
            <Button
              type="button"
              variant={onlyFavorites ? 'secondary' : 'outline'}
              size="xs"
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={cn(
                'h-7 gap-1 text-[11px]',
                onlyFavorites && 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber'
              )}
            >
              <Star
                className={cn(
                  'h-3 w-3',
                  onlyFavorites ? 'fill-accent-amber text-accent-amber' : 'text-text-muted'
                )}
              />
              <span>{tx("Favorites")}</span>
            </Button>

            {/* Project Picker (if not fixed to a specific project) */}
            {!fixedProjectId && (
              <div className="w-36 sm:w-44">
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <FolderGit2 className="h-3 w-3 mr-1 text-text-muted shrink-0" />
                    <SelectValue placeholder={tx("All Projects")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tx("All Projects")}</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-mono text-[10px] text-accent-blue/80 mr-1">
                          {p.identifier}
                        </span>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tags Filter */}
            {availableTags.length > 0 && (
              <div className="w-32 sm:w-40">
                <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                  <SelectTrigger className="h-7 text-[11px]">
                    <TagIcon className="h-3 w-3 mr-1 text-text-muted shrink-0" />
                    <SelectValue placeholder={tx("All Tags")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tx("All Tags")}</SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        #{tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Trash View Toggle */}
            <Button
              type="button"
              variant={showTrash ? 'danger' : 'ghost'}
              size="xs"
              onClick={() => setShowTrash(!showTrash)}
              className="h-7 gap-1 text-[11px] text-text-muted"
              title={tx("View Trash")}
            >
              <Trash2 className="h-3 w-3" />
              <span>{tx("Trash")}</span>
            </Button>

            {/* Clear filters shortcut */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="xs"
                onClick={resetFilters}
                className="h-7 text-[11px] text-text-muted hover:text-text-primary"
              >
                {tx("Reset")}</Button>
            )}
          </div>

          {/* View Mode Toggle: Grid vs List */}
          <div className="flex items-center gap-0.5 rounded border border-border bg-bg-base p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded text-xs transition-colors',
                viewMode === 'grid'
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              )}
              title={tx("Grid view")}
            >
              <LayoutGrid className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded text-xs transition-colors',
                viewMode === 'list'
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              )}
              title={tx("List view")}
            >
              <ListIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Resource Cards / Content */}
      {resources.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onSelect={handleCardSelect}
                onEdit={handleCardEdit}
                onDelete={handleCardDelete}
                showProject={!fixedProjectId}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onSelect={handleCardSelect}
                onEdit={handleCardEdit}
                onDelete={handleCardDelete}
                showProject={!fixedProjectId}
              />
            ))}
          </div>
        )
      ) : (
        /* Empty State */
        <EmptyState
          icon={showTrash ? Trash2 : selectedType === 'link' ? Globe : selectedType === 'snippet' ? Code : FileText}
          title={
            showTrash
              ? 'Trash is empty'
              : hasActiveFilters
              ? 'No matching resources'
              : 'No resources saved yet'
          }
          description={
            showTrash
              ? 'Items in the trash will appear here. Soft-deleted items can be restored anytime.'
              : hasActiveFilters
              ? 'Try relaxing your search query or removing active filters.'
              : 'Save helpful website links, code snippets, and reference files to keep your team aligned.'
          }
          actionLabel={
            showTrash
              ? undefined
              : hasActiveFilters
              ? 'Clear Filters'
              : 'Create Resource'
          }
          onAction={
            showTrash
              ? undefined
              : hasActiveFilters
              ? resetFilters
              : () => setIsCreateOpen(true)
          }
        />
      )}

      {/* Dialogs */}
      <CreateResourceDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        initialProjectId={fixedProjectId}
        initialType={selectedType !== 'all' ? selectedType : 'link'}
        onSuccess={(created) => {
          setDetailResource(created)
        }}
      />

      <EditResourceDialog
        resource={editResource}
        open={!!editResource}
        onOpenChange={(open) => !open && setEditResource(null)}
      />

      <ResourceDetailModal
        resource={visibleDetailResource}
        open={!!visibleDetailResource}
        onOpenChange={(open) => {
          if (open) return
          setDetailResource(null)
          if (selectedResourceId) onClearSelectedResource?.()
        }}
        onEdit={(res) => {
          setDetailResource(null)
          if (selectedResourceId) onClearSelectedResource?.()
          setEditResource(res)
        }}
        onDelete={(res) => {
          handleCardDelete(res)
        }}
      />
    </div>
  )
}
