import * as React from 'react'
import type { Note } from '@/types'
import {
  FileText,
  Star,
  Search,
  Plus,
  Trash2,
  X,
  Clock,
  Filter,
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
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useNotes, useTags, useKnowledgeCounts } from '@/hooks/useKnowledge'
import { useProjects } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import { NoteCard } from './NoteCard'
import { CreateNoteDialog } from './CreateNoteDialog'
import { useTranslation } from '@/i18n'

export type NoteTab = 'all' | 'favorites' | 'recent' | 'trash'
export type NoteSortOption = 'recently_updated' | 'recently_created' | 'title_asc' | 'title_desc'

export interface NoteListProps {
  /** Optional project scope */
  projectId?: string
  /** Currently selected note ID */
  selectedNoteId?: string
  /** Callback when a note is selected */
  onSelectNote?: (note: Note) => void
  /** Callback or external trigger for New Note */
  onNewNote?: () => void
  /** Whether to show the top header and title bar */
  showHeader?: boolean
  /** Optional extra classes */
  className?: string
}

export function NoteList({
  projectId: fixedProjectId,
  selectedNoteId,
  onSelectNote,
  onNewNote,
  showHeader = true,
  className,
}: NoteListProps) {
  const { t, tx } = useTranslation()
  const projects = useProjects() || []
  const availableTags = useTags() || []
  const counts = useKnowledgeCounts(fixedProjectId)

  // Filter States
  const [activeTab, setActiveTab] = React.useState<NoteTab>('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(
    fixedProjectId || 'all'
  )
  const [selectedTagId, setSelectedTagId] = React.useState<string>('all')
  const [sortBy, setSortBy] = React.useState<NoteSortOption>('recently_updated')

  // Create Note Dialog State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)

  const effectiveProjectId =
    fixedProjectId || (selectedProjectId !== 'all' ? selectedProjectId : undefined)
  const effectiveTagId = selectedTagId !== 'all' ? selectedTagId : undefined
  const isTrashTab = activeTab === 'trash'

  // Query notes using Dexie live query
  const rawNotes = useNotes({
    projectId: effectiveProjectId,
    tagId: effectiveTagId,
    isFavorite: activeTab === 'favorites' ? true : undefined,
    showTrash: isTrashTab,
    search: searchQuery.trim() || undefined,
  })

  // Sort notes
  const sortedNotes = React.useMemo(() => {
    const list = [...rawNotes]
    switch (sortBy) {
      case 'recently_updated':
        return list.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      case 'recently_created':
        return list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      case 'title_asc':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      case 'title_desc':
        return list.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
      default:
        return list
    }
  }, [rawNotes, sortBy])

  const handleOpenCreate = () => {
    if (onNewNote) {
      onNewNote()
    } else {
      setIsCreateOpen(true)
    }
  }

  const handleCreated = (note: Note) => {
    onSelectNote?.(note)
  }

  const resetFilters = () => {
    setSearchQuery('')
    if (!fixedProjectId) setSelectedProjectId('all')
    setSelectedTagId('all')
    setActiveTab('all')
  }

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    (!fixedProjectId && selectedProjectId !== 'all') ||
    selectedTagId !== 'all'

  return (
    <div className={cn('flex flex-col h-full bg-bg-surface border-r border-border', className)}>
      {/* Optional Top Title Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-accent-blue/15 text-accent-blue">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-xs font-semibold text-text-primary tracking-tight">
              {tx("Notes Library")}</h2>
            <Badge variant="subtle" className="font-mono text-[10px] px-1.5 py-0 h-4">
              {counts.notes}
            </Badge>
          </div>

          <Button
            size="xs"
            onClick={handleOpenCreate}
            className="gap-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            {tx("New Note")}</Button>
        </div>
      )}

      {/* Tabs Row */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-border/80 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap',
            activeTab === 'all'
              ? 'bg-bg-elevated text-text-primary border border-border shadow-xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50'
          )}
        >
          <span>{tx("All Notes")}</span>
          {counts.notes > 0 && (
            <span className="text-[10px] text-text-muted font-mono">
              {counts.notes}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap',
            activeTab === 'favorites'
              ? 'bg-bg-elevated text-accent-amber border border-border shadow-xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50'
          )}
        >
          <Star className="h-3 w-3" />
          <span>{tx("Favorites")}</span>
          {counts.favorites > 0 && (
            <span className="text-[10px] font-mono text-accent-amber/80">
              {counts.favorites}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('recent')
            setSortBy('recently_updated')
          }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap',
            activeTab === 'recent'
              ? 'bg-bg-elevated text-text-primary border border-border shadow-xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50'
          )}
        >
          <Clock className="h-3 w-3 text-text-muted" />
          <span>{tx("Recently Edited")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trash')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ml-auto',
            activeTab === 'trash'
              ? 'bg-bg-elevated text-accent-red border border-border shadow-xs'
              : 'text-text-secondary hover:text-accent-red hover:bg-bg-elevated/50'
          )}
        >
          <Trash2 className="h-3 w-3" />
          <span>{tx("Trash")}</span>
          {counts.trash > 0 && (
            <span className="text-[10px] font-mono text-accent-red/80">
              {counts.trash}
            </span>
          )}
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-3 space-y-2 border-b border-border/60">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('knowledge.notes.searchPlaceholder')}
            placeholder={t('knowledge.notes.searchPlaceholder')}
            className="pl-8 pr-7 h-7 text-xs bg-bg-base border-border placeholder:text-text-muted"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters & Sort */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Project Picker (if not fixed) */}
          {!fixedProjectId && (
            <div className="min-w-[120px] flex-1">
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="h-7 text-xs bg-bg-base border-border">
                  <SelectValue placeholder={tx("All Projects")} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">
                    <span className="text-text-secondary">{tx("All Projects")}</span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="truncate">{p.identifier || p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tag Picker */}
          {availableTags.length > 0 && (
            <div className="min-w-[110px] flex-1">
              <Select
                value={selectedTagId}
                onValueChange={setSelectedTagId}
              >
                <SelectTrigger className="h-7 text-xs bg-bg-base border-border">
                  <SelectValue placeholder={tx("All Tags")} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">
                    <span className="text-text-secondary">{tx("All Tags")}</span>
                  </SelectItem>
                  {availableTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color || '#6366f1' }}
                        />
                        <span>{tag.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Sort Option */}
          <div className="w-[130px]">
            <Select
              value={sortBy}
              onValueChange={(val) => setSortBy(val as NoteSortOption)}
            >
              <SelectTrigger className="h-7 text-xs bg-bg-base border-border">
                <SelectValue placeholder={tx("Sort...")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recently_updated">{tx("Recently Updated")}</SelectItem>
                <SelectItem value="recently_created">{tx("Recently Created")}</SelectItem>
                <SelectItem value="title_asc">{tx("Title (A-Z)")}</SelectItem>
                <SelectItem value="title_desc">{tx("Title (Z-A)")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters CTA if dirty */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="xs"
              onClick={resetFilters}
              className="h-7 text-[11px] text-text-muted hover:text-text-primary px-1.5"
            >
              {tx("Reset")}</Button>
          )}
        </div>
      </div>

      {/* Note Cards Scrollable List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sortedNotes.length > 0 ? (
          sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isSelected={note.id === selectedNoteId}
              onSelect={onSelectNote}
              showProject={!fixedProjectId}
            />
          ))
        ) : (
          <div className="p-4">
            {searchQuery ? (
              <EmptyState
                icon={Search}
                title={tx("No matching notes")}
                description={t('knowledge.empty.searchDesc', { query: searchQuery })}
                actionLabel={t('knowledge.empty.clearSearch')}
                onAction={() => setSearchQuery('')}
              />
            ) : isTrashTab ? (
              <EmptyState
                icon={Trash2}
                title={tx("Trash is empty")}
                description={t('knowledge.empty.trashDesc')}
              />
            ) : activeTab === 'favorites' ? (
              <EmptyState
                icon={Star}
                title={tx("No favorite notes")}
                description={t('knowledge.empty.favoritesDesc')}
              />
            ) : hasActiveFilters ? (
              <EmptyState
                icon={Filter}
                title={tx("No notes match filters")}
                description={t('knowledge.empty.filtersDesc')}
                actionLabel={t('knowledge.empty.resetFilters')}
                onAction={resetFilters}
              />
            ) : (
              <EmptyState
                icon={FileText}
                title={tx("No notes yet")}
                description={t('knowledge.empty.firstNoteDesc')}
                actionLabel={t('knowledge.empty.createNote')}
                onAction={handleOpenCreate}
              />
            )}
          </div>
        )}
      </div>

      {/* Create Note Dialog Modal */}
      <CreateNoteDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        initialProjectId={effectiveProjectId}
        onCreated={handleCreated}
      />
    </div>
  )
}
