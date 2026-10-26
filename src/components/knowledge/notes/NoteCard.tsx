import * as React from 'react'
import type { Note } from '@/types'
import {
  FileText,
  Star,
  Copy,
  Trash2,
  RotateCcw,
  MoreVertical,
  FolderGit2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEntityTags, useKnowledgeActions } from '@/hooks/useKnowledge'
import { useProject } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import { formatTimeAgo, exportNoteAsMarkdown } from './noteUtils'
import { useTranslation } from '@/i18n'

export interface NoteCardProps {
  note: Note
  isSelected?: boolean
  onClick?: () => void
  onSelect?: (note: Note) => void
  onDuplicate?: (note: Note) => void
  onDelete?: (note: Note) => void
  className?: string
  showProject?: boolean
}

export function NoteCard({
  note,
  isSelected = false,
  onClick,
  onSelect,
  onDuplicate,
  onDelete,
  className,
  showProject = true,
}: NoteCardProps) {
  const { tx } = useTranslation()
  const {
    toggleNoteFavorite,
    softDeleteNote,
    restoreNote,
    deleteNotePermanently,
    createNote,
  } = useKnowledgeActions()

  const [isPermanentAlertOpen, setIsPermanentAlertOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Associated project
  const project = useProject(note.projectId)

  // Associated tags
  const tags = useEntityTags('note', note.id)

  const isTrash = !!note.deletedAt

  // Plain text preview snippet (clean up whitespace, limit to ~120 chars)
  const previewSnippet = React.useMemo(() => {
    if (!note.plainText) return ''
    const cleaned = note.plainText.replace(/\s+/g, ' ').trim()
    if (cleaned.length > 130) {
      return cleaned.slice(0, 130) + '…'
    }
    return cleaned
  }, [note.plainText])

  const handleCardClick = () => {
    onClick?.()
    onSelect?.(note)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await toggleNoteFavorite(note.id)
    } catch (err) {
      console.error('Failed to toggle note favorite:', err)
    }
  }

  const handleDuplicate = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const duplicated = await createNote({
        title: (note.title || tx('Untitled Note')) + ' (' + tx('Copy') + ')',
        contentJSON: note.contentJSON,
        plainText: note.plainText,
        projectId: note.projectId,
        isFavorite: false,
      })
      onDuplicate?.(duplicated)
    } catch (err) {
      console.error('Failed to duplicate note:', err)
    }
  }

  const handleSoftDelete = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const updated = await softDeleteNote(note.id)
      onDelete?.(updated)
    } catch (err) {
      console.error('Failed to move note to trash:', err)
    }
  }

  const handleRestore = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await restoreNote(note.id)
    } catch (err) {
      console.error('Failed to restore note:', err)
    }
  }

  const handleExport = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    exportNoteAsMarkdown(note)
  }

  const handleConfirmPermanentDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteNotePermanently(note.id)
      setIsPermanentAlertOpen(false)
      onDelete?.(note)
    } catch (err) {
      console.error('Failed to permanently delete note:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'group relative flex flex-col justify-between rounded-lg border p-3 text-left transition-all outline-none cursor-pointer',
          'bg-bg-surface hover:bg-bg-elevated/70 hover:border-border/90',
          isSelected
            ? 'border-accent-olive/60 bg-bg-elevated ring-1 ring-accent-olive/40 shadow-sm'
            : 'border-border',
          isTrash && 'opacity-75 hover:opacity-100 border-dashed border-border-subtle bg-bg-surface/50',
          className
        )}
      >
        {/* Header row: Star, Title, Project badge, More menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {/* Favorite Star Button */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              title={note.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
              className={cn(
                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors',
                note.isFavorite
                  ? 'text-accent-amber hover:text-accent-amber/80'
                  : 'text-text-muted/40 hover:text-text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100'
              )}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5',
                  note.isFavorite && 'fill-accent-amber'
                )}
              />
            </button>

            {/* Note Title & Trash badge */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4
                  className={cn(
                    'text-xs font-semibold tracking-tight truncate leading-tight text-text-primary',
                    !note.title && 'italic text-text-muted font-normal'
                  )}
                >
                  {note.title?.trim() || tx('Untitled Note')}
                </h4>

                {isTrash && (
                  <Badge variant="warning" className="text-[9px] px-1 py-0 h-4 uppercase tracking-wider">
                    {tx("Trash")}</Badge>
                )}

                {note.isFavorite && (
                  <Badge
                    variant="subtle"
                    className="text-[9px] px-1 py-0 h-4 bg-accent-amber/10 text-accent-amber border-accent-amber/20"
                  >
                    {tx("Pinned")}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Context Action Menu */}
          <div
            className="flex items-center gap-1 shrink-0 ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">{tx("Note options")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleToggleFavorite}>
                  <Star
                    className={cn(
                      'mr-2 h-3.5 w-3.5',
                      note.isFavorite ? 'fill-accent-amber text-accent-amber' : ''
                    )}
                  />
                  {note.isFavorite ? tx("Unfavorite") : tx("Favorite")}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  {tx("Duplicate")}</DropdownMenuItem>

                <DropdownMenuItem onClick={handleExport}>
                  <FileText className="mr-2 h-3.5 w-3.5" />
                  {tx("Export Markdown")}</DropdownMenuItem>

                <DropdownMenuSeparator />

                {isTrash ? (
                  <>
                    <DropdownMenuItem onClick={handleRestore}>
                      <RotateCcw className="mr-2 h-3.5 w-3.5 text-accent-green" />
                      {tx("Restore Note")}</DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setIsPermanentAlertOpen(true)}
                      className="text-accent-red focus:text-accent-red focus:bg-accent-red/10"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      {tx("Delete Permanently")}</DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onClick={handleSoftDelete}
                    className="text-accent-red focus:text-accent-red focus:bg-accent-red/10"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {tx("Move to Trash")}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content Preview Snippet */}
        <div className="mt-1.5 pl-7 pr-1">
          <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
            {previewSnippet || (
              <span className="text-text-muted italic">{tx("No additional content")}</span>
            )}
          </p>
        </div>

        {/* Footer Meta Row: Project badge, Tags, Updated Time */}
        <div className="mt-2.5 pl-7 flex items-center justify-between gap-2 text-[10px] text-text-muted">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden flex-wrap">
            {showProject && project && (
              <span
                className="inline-flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 border border-border text-text-secondary shrink-0 font-mono text-[10px]"
                title={`Project: ${project.name}`}
              >
                {project.icon ? (
                  <span className="text-[11px] leading-none">{project.icon}</span>
                ) : (
                  <FolderGit2 className="h-3 w-3 text-text-muted" />
                )}
                <span className="truncate max-w-[100px]">{project.identifier || project.name}</span>
              </span>
            )}

            {tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-[9px] px-1 py-0 h-4 border-border/80 text-text-secondary"
                style={{
                  borderColor: tag.color ? `${tag.color}40` : undefined,
                  backgroundColor: tag.color ? `${tag.color}15` : undefined,
                }}
              >
                #{tag.name}
              </Badge>
            ))}

            {tags.length > 2 && (
              <span className="text-text-muted text-[10px]">
                +{tags.length - 2}
              </span>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-1.5 text-text-muted/80">
            <span>{formatTimeAgo(note.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={isPermanentAlertOpen} onOpenChange={setIsPermanentAlertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-accent-red mb-1">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>{tx("Delete Note Permanently?")}</DialogTitle>
            </div>
            <DialogDescription>
              {tx("Are you sure you want to permanently delete “")}<strong className="text-text-primary">{note.title || tx('Untitled Note')}</strong>
              {tx("”? This action cannot be undone and will remove all revisions and attachments.")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPermanentAlertOpen(false)}
              disabled={isDeleting}
            >
              {tx("Cancel")}</Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmPermanentDelete}
              disabled={isDeleting}
            >
              {isDeleting ? tx("Deleting...") : tx("Delete Permanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
