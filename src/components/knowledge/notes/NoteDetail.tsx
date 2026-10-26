import * as React from 'react'
import type { Note } from '@/types'
import {
  ArrowLeft,
  Star,
  Copy,
  FileDown,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FolderGit2,
  Tag as TagIcon,
  Link2,
  Check,
  MoreVertical,
  FileText,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { EmptyState } from '@/components/shared/EmptyState'
import {
  useNote,
  useTags,
  useEntityTags,
  useKnowledgeActions,
} from '@/hooks/useKnowledge'
import { useProjects } from '@/hooks/useProjects'
import { NoteEditor } from '@/components/knowledge/editor'
import { EntityLinker } from '@/components/knowledge/relationships/EntityLinker'
import { cn } from '@/lib/utils'
import { exportNoteAsMarkdown } from './noteUtils'
import { NoteUpdateCoordinator } from './noteUpdateCoordinator'
import { readNoteDraft, removeNoteDraft, writeNoteDraft } from '@/components/knowledge/editor/draftRecovery'

export interface NoteDetailProps {
  noteId?: string
  initialNote?: Note
  onBack?: () => void
  onNoteDeleted?: (noteId: string) => void
  onNoteDuplicated?: (newNote: Note) => void
  className?: string
}

function formatNoteUpdated(date: Date, lang: string): string {
  const d = new Date(date)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  if (lang === 'ru') {
    return `ОБНОВЛЕНО СЕГОДНЯ, ${hours}:${minutes}`
  }
  return `UPDATED TODAY, ${hours}:${minutes}`
}

export function NoteDetail({
  noteId,
  initialNote,
  onBack,
  onNoteDeleted,
  onNoteDuplicated,
  className,
}: NoteDetailProps) {
  const { t, tx, i18n } = useTranslation()

  // Reactive live query for note
  const queriedNote = useNote(noteId)
  const note = queriedNote || initialNote

  const {
    updateNote,
    softDeleteNote,
    restoreNote,
    deleteNotePermanently,
    createNote,
    setEntityTags,
    getOrCreateTag,
  } = useKnowledgeActions()

  const projects = useProjects() || []
  const availableTags = useTags() || []
  const assignedTags = useEntityTags('note', note?.id)
  const linkedProject = projects.find((p) => p.id === note?.projectId)

  const [revisionError, setRevisionError] = React.useState<string | null>(null)
  const [isPermanentAlertOpen, setIsPermanentAlertOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isAddTagOpen, setIsAddTagOpen] = React.useState(false)
  const [isLinkerOpen, setIsLinkerOpen] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState('')
  const [, forceRevisionRender] = React.useReducer((revision: number) => revision + 1, 0)
  const [titleDraftState, setTitleDraftState] = React.useState<{ noteId: string; value: string } | null>(null)
  const [titleDirtyNoteId, setTitleDirtyNoteId] = React.useState<string | null>(null)
  const titleDraft = titleDraftState && titleDraftState.noteId === note?.id
    ? titleDraftState.value
    : (note?.title ?? '')
  const isTitleDirty = titleDirtyNoteId === note?.id && note !== undefined
  const titleDraftRef = React.useRef(titleDraft)
  const titleDirtyRef = React.useRef(false)
  const lastTitleNoteIdRef = React.useRef(note?.id)
  const titleSaveTimeoutRef = React.useRef<number | null>(null)

  // Keep the initial revision for this note identity; live revisions are adopted only while clean.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const noteWriter = React.useMemo(() => new NoteUpdateCoordinator(
    note?.revision ?? initialNote?.revision ?? 1,
    async (updates, expectedRevision) => {
      const targetNoteId = note?.id ?? noteId
      if (!targetNoteId) throw new Error('Cannot save a note without an id')
      const updated = await updateNote(targetNoteId, { ...updates, expectedRevision })
      return updated.revision
    }
  ), [note?.id, noteId, updateNote])

  React.useEffect(() => {
    if (lastTitleNoteIdRef.current !== note?.id) {
      lastTitleNoteIdRef.current = note?.id
      titleDirtyRef.current = false
      titleDraftRef.current = note?.title ?? ''
    } else if (!titleDirtyRef.current) {
      titleDraftRef.current = note?.title ?? ''
    }
  }, [note?.id, note?.title])

  React.useEffect(() => () => {
    const titleTimeout = titleSaveTimeoutRef.current
    const titleWasWaitingForDebounce = titleTimeout !== null
    if (titleTimeout !== null) {
      window.clearTimeout(titleTimeout)
      titleSaveTimeoutRef.current = null
    }
    if (titleWasWaitingForDebounce && titleDirtyRef.current) {
      void noteWriter.update({ title: titleDraftRef.current.trim() }).catch(() => undefined)
    }
  }, [note?.id, noteWriter])

  const isTrash = !!note?.deletedAt

  // All writes from this NoteDetail instance share one serialized revision stream.
  const handleSave = React.useCallback(
    async (jsonString: string, plainText: string, _editorRevision: number, title: string) => {
      if (!note) throw new Error('The note is no longer available')
      if (titleSaveTimeoutRef.current !== null) {
        window.clearTimeout(titleSaveTimeoutRef.current)
        titleSaveTimeoutRef.current = null
      }
      try {
        const revision = await noteWriter.update({
          contentJSON: jsonString,
          plainText,
          title: title.trim(),
        })
        forceRevisionRender()
        setRevisionError(null)
        if (titleDraftRef.current.trim() === title.trim()) {
          titleDirtyRef.current = false
          setTitleDirtyNoteId(null)
          setTitleDraftState(null)
        }
        return revision
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('revision') || msg.toLowerCase().includes('conflict')) {
          setRevisionError(
            t('knowledge.editor.revisionConflict')
          )
        } else {
          setRevisionError(t('knowledge.editor.failed'))
        }
        throw err
      }
    },
    [note, noteWriter, t]
  )

  const markEditorDraft = React.useCallback((expectedRevision: number) => {
    noteWriter.adoptRevision(expectedRevision)
    noteWriter.markDirty()
  }, [noteWriter])
  const markEditorDraftSaved = React.useCallback(() => noteWriter.markClean(), [noteWriter])

  const persistMetadata = React.useCallback(async (updates: Parameters<NoteUpdateCoordinator['update']>[0]) => {
    try {
      if (note) noteWriter.adoptRevision(note.revision)
      const revision = await noteWriter.update(updates)
      forceRevisionRender()
      setRevisionError(null)
      if (updates.title !== undefined && titleDraftRef.current.trim() === updates.title.trim()) {
        titleDirtyRef.current = false
        setTitleDirtyNoteId(null)
        setTitleDraftState(null)
      }
      if (note?.id) {
        const draft = readNoteDraft(note.id)
        const nextTitle = updates.title?.trim() ?? draft?.title
        if (draft && nextTitle !== undefined) {
          if (
            updates.title !== undefined &&
            draft.contentJSON === note.contentJSON &&
            draft.plainText === note.plainText &&
            draft.title === nextTitle
          ) {
            removeNoteDraft(note.id)
          } else {
            writeNoteDraft(note.id, { ...draft, title: nextTitle }, revision)
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setRevisionError(msg.toLowerCase().includes('revision') || msg.toLowerCase().includes('conflict')
        ? t('knowledge.editor.revisionConflict')
        : t('knowledge.editor.failed'))
      throw err
    }
  }, [note, noteWriter, t])

  // Handle title changes
  const handleTitleChange = React.useCallback(
    (newTitle: string) => {
      titleDraftRef.current = newTitle
      titleDirtyRef.current = true
      if (note?.id) {
        setTitleDirtyNoteId(note.id)
        setTitleDraftState({ noteId: note.id, value: newTitle })
      }
      if (note?.id) {
        const currentDraft = readNoteDraft(note.id)
        writeNoteDraft(note.id, {
          title: newTitle,
          contentJSON: currentDraft?.contentJSON ?? note.contentJSON,
          plainText: currentDraft?.plainText ?? note.plainText,
        }, currentDraft?.baseRevision ?? noteWriter.revision)
      }
      if (titleSaveTimeoutRef.current !== null) window.clearTimeout(titleSaveTimeoutRef.current)
      titleSaveTimeoutRef.current = window.setTimeout(() => {
        titleSaveTimeoutRef.current = null
        void persistMetadata({ title: titleDraftRef.current.trim() }).catch(() => undefined)
      }, 400)
    },
    [note, noteWriter, persistMetadata]
  )

  // Project selector change
  const handleProjectChange = async (projectId: string) => {
    if (!note) return
    try {
      await persistMetadata({
        projectId: projectId === 'none' ? null : projectId,
      })
    } catch (err) {
      console.error('Failed to change project:', err)
    }
  }

  // Toggle favorite
  const handleToggleFavorite = async () => {
    if (!note) return
    try {
      await persistMetadata({ isFavorite: !note.isFavorite })
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

  // Duplicate note
  const handleDuplicate = async () => {
    if (!note) return
    try {
      const duplicated = await createNote({
        title: (note.title || tx('Untitled Note')) + ' (' + tx('Copy') + ')',
        contentJSON: note.contentJSON,
        plainText: note.plainText,
        projectId: note.projectId,
        isFavorite: false,
      })
      onNoteDuplicated?.(duplicated)
    } catch (err) {
      console.error('Failed to duplicate note:', err)
    }
  }

  // Export as Markdown (.md file download)
  const handleExportMarkdown = () => {
    if (!note) return
    exportNoteAsMarkdown(note)
  }

  // Soft delete / Move to trash
  const handleSoftDelete = async () => {
    if (!note) return
    try {
      await softDeleteNote(note.id)
    } catch (err) {
      console.error('Failed to move note to trash:', err)
    }
  }

  // Restore note from trash
  const handleRestore = async () => {
    if (!note) return
    try {
      await restoreNote(note.id)
      setRevisionError(null)
    } catch (err) {
      console.error('Failed to restore note:', err)
    }
  }

  // Permanent Delete confirmation
  const handlePermanentDelete = async () => {
    if (!note) return
    setIsDeleting(true)
    try {
      await deleteNotePermanently(note.id)
      setIsPermanentAlertOpen(false)
      onNoteDeleted?.(note.id)
    } catch (err) {
      console.error('Failed to delete note permanently:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Toggle tag attachment
  const handleToggleTag = async (tagId: string) => {
    if (!note) return
    const isAssigned = assignedTags.some((t) => t.id === tagId)
    const newTagIds = isAssigned
      ? assignedTags.filter((t) => t.id !== tagId).map((t) => t.id)
      : [...assignedTags.map((t) => t.id), tagId]

    try {
      await setEntityTags('note', note.id, newTagIds)
    } catch (err) {
      console.error('Failed to update note tags:', err)
    }
  }

  // Create new tag from input
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagName.trim() || !note) return

    try {
      const createdTag = await getOrCreateTag(newTagName.trim())
      const newTagIds = [...assignedTags.map((t) => t.id), createdTag.id]
      await setEntityTags('note', note.id, newTagIds)
      setNewTagName('')
      setIsAddTagOpen(false)
    } catch (err) {
      console.error('Failed to create tag:', err)
    }
  }

  // Empty state if note not found or none selected
  if (!note) {
    return (
      <div className={cn('flex flex-col h-full items-center justify-center p-8 bg-bg-base', className)}>
        <EmptyState
          icon={FileDown}
          title={t('knowledge.noNoteSelected')}
          description={t('knowledge.noNoteSelectedDesc')}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full bg-bg-base overflow-hidden', className)}>
      {/* ─── Top Editorial Action Bar (Stitch Screenshot 2) ─── */}
      <div className="flex shrink-0 flex-col items-stretch gap-2 border-b border-border-subtle bg-bg-surface px-3 py-2 select-none sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-3">
        {/* Left: Note Status & Project Picker */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-7 w-7 text-text-secondary hover:text-text-primary lg:hidden"
              title={tx("Back")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-accent-olive" aria-hidden="true" />
            <span title={t('knowledge.noteSaved')} className="hidden font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted sm:inline">
              {t('knowledge.noteSaved')}
            </span>
          </div>

          <div className="hidden h-3.5 w-px shrink-0 bg-border-subtle sm:block" />

          {/* Project Association Selector */}
          <div className="w-[132px] shrink-0 sm:w-[190px]">
            <Select
              value={note.projectId || 'none'}
              onValueChange={handleProjectChange}
              disabled={isTrash}
            >
              <SelectTrigger className="h-7 text-xs bg-bg-base/70 border-border-subtle text-text-secondary hover:text-text-primary">
                <SelectValue placeholder={tx("No Project")} />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="none">
                  <span className="text-text-muted">{tx("Global (No Project)")}</span>
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {p.icon ? <span>{p.icon}</span> : <FolderGit2 className="h-3.5 w-3.5 text-text-muted" />}
                      <span className="font-mono text-[10px] text-accent-olive">
                        {p.identifier}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right: Actions "Связать", Share, Export, etc. */}
        <div className="flex w-full shrink-0 items-center justify-end gap-1.5 sm:w-auto sm:gap-2">
          {/* "Связать" Action Button (Triggers EntityLinker) */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsLinkerOpen(true)}
            disabled={isTrash}
            className="gap-1.5 h-7 text-xs text-text-secondary hover:text-text-primary"
            title={t('knowledge.connect')}
            aria-label={t('knowledge.connect')}
          >
            <Link2 className="h-3.5 w-3.5 text-accent-olive" />
            <span className="hidden sm:inline">{t('knowledge.connect')}</span>
          </Button>

          {/* Tags Dropdown Popover */}
          <DropdownMenu open={isAddTagOpen} onOpenChange={setIsAddTagOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                disabled={isTrash}
                className="gap-1 text-xs h-7 text-text-secondary hover:text-text-primary"
                title={t('knowledge.tags')}
                aria-label={t('knowledge.tags')}
              >
                <TagIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('knowledge.tags')}</span>
                {assignedTags.length > 0 && (
                  <Badge variant="subtle" className="h-4 px-1 text-[9px] font-mono">
                    {assignedTags.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 space-y-2 bg-bg-surface border-border">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-1">
                {t('knowledge.tags')}
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 py-1">
                {availableTags.map((tag) => {
                  const isChecked = assignedTags.some((at) => at.id === tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors text-left',
                        isChecked
                          ? 'bg-accent-olive/15 text-accent-olive font-medium'
                          : 'hover:bg-bg-hover text-text-secondary'
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color || '#8a9e6b' }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </div>
                      {isChecked && <Check className="h-3 w-3 shrink-0" />}
                    </button>
                  )
                })}
              </div>

              <form onSubmit={handleCreateTag} className="pt-2 border-t border-border-subtle flex gap-1">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder={tx("New tag...")}
                  className="flex-1 h-6 px-2 rounded bg-bg-base border border-border text-[11px] text-text-primary outline-none focus:border-accent-olive"
                />
                <Button type="submit" size="xs" variant="olive" className="h-6 px-2 text-[10px]">
                  {tx("Add")}</Button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Favorite */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleFavorite}
            title={tx("Favorite")}
            className="h-7 w-7 text-text-muted hover:text-text-primary"
          >
            <Star className={cn('h-3.5 w-3.5', note.isFavorite && 'fill-accent-amber text-accent-amber')} />
          </Button>

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-text-muted hover:text-text-primary"
                title={tx("More actions")}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-bg-surface border-border">
              <DropdownMenuItem onClick={handleDuplicate} className="gap-2 text-xs cursor-pointer">
                <Copy className="h-3.5 w-3.5" />
                <span>{tx("Duplicate")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportMarkdown} className="gap-2 text-xs cursor-pointer">
                <FileDown className="h-3.5 w-3.5" />
                <span>{tx("Export (.md)")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isTrash ? (
                <DropdownMenuItem onClick={handleRestore} className="gap-2 text-xs text-accent-green cursor-pointer">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{tx("Restore")}</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleSoftDelete} className="gap-2 text-xs text-accent-red cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{tx("Move to Trash")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* "Опубликовать" / "Экспорт" Action Button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportMarkdown}
            className="h-7 px-3 text-xs gap-1.5 bg-bg-elevated/80 border-border text-text-primary hover:bg-bg-hover"
          >
            <span>{t('knowledge.publish')}</span>
          </Button>
        </div>
      </div>

      {/* ─── Read-Only Trash Warning Banner ─── */}
      {isTrash && (
        <div className="flex items-center justify-between gap-3 px-6 py-2 bg-accent-amber/10 border-b border-accent-amber/20 text-accent-amber shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-accent-amber" />
            <span>{tx("This note is in the trash. It is read-only until restored.")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="xs"
              onClick={handleRestore}
              className="bg-accent-amber hover:bg-accent-amber/90 text-black font-semibold gap-1.5 h-6 text-[11px]"
            >
              <RotateCcw className="h-3 w-3" />
              {tx("Restore")}</Button>
            <Button
              variant="danger"
              size="xs"
              onClick={() => setIsPermanentAlertOpen(true)}
              className="gap-1.5 h-6 text-[11px]"
            >
              <Trash2 className="h-3 w-3" />
              {tx("Delete Permanently")}</Button>
          </div>
        </div>
      )}

      {/* ─── Conflict Notice Banner ─── */}
      {revisionError && (
        <div className="flex items-center justify-between gap-3 px-6 py-2 bg-accent-red/10 border-b border-accent-red/20 text-accent-red shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{revisionError}</span>
          </div>
          {isTitleDirty && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void persistMetadata({ title: titleDraftRef.current.trim() }).catch(() => undefined)}
              className="text-accent-red hover:bg-accent-red/20 h-6 px-2 text-[11px]"
            >
              {t('knowledge.editor.retry')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setRevisionError(null)}
            className="text-accent-red hover:bg-accent-red/20 h-6 px-2 text-[11px]"
          >
            {tx("Dismiss")}</Button>
        </div>
      )}

      {/* ─── Main Document Area (Stitch Screenshot 2) ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:space-y-7 lg:px-8 lg:py-9">
          {/* Article Header (Stitch Reference) */}
          <div className="space-y-4 pb-6 border-b border-border-subtle/50">
            {/* Tag pill + Updated timestamp */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-bg-surface border border-border-subtle text-accent-olive font-semibold">
                {assignedTags[0]?.name?.toUpperCase() || t('knowledge.principle')}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {formatNoteUpdated(note.updatedAt, i18n.language)}
              </span>
            </div>

            {/* Note Title Input with Large Editorial Serif Typography */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={titleDraft}
                  disabled={isTrash}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  aria-label={t('knowledge.noteTitle')}
                  placeholder={`${t('knowledge.noteTitle')}...`}
                  className="w-full bg-transparent font-serif text-[18px] font-normal leading-tight tracking-tight text-text-primary outline-none border-0 p-0 placeholder:text-text-muted/40 focus:ring-0 sm:text-2xl lg:text-3xl"
                />

                {/* Author & Project Meta line */}
                <div className="flex items-center gap-3 mt-4 text-xs text-text-secondary flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-[#273220] border border-accent-olive/30 flex items-center justify-center text-[9px] font-serif font-bold text-accent-olive">
                      А
                    </div>
                    <span className="font-medium text-text-primary">Алекс Морган</span>
                  </div>

                  {linkedProject && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-olive" />
                      <span className="font-medium text-text-secondary">
                        {linkedProject.name}
                      </span>
                    </div>
                  )}

                  {/* Tag Pills */}
                  {assignedTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-bg-surface border border-border-subtle text-text-muted"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Table of Contents Column (Stitch Reference) */}
              <div className="hidden xl:flex flex-col space-y-1.5 text-[10px] font-mono tracking-wider uppercase text-text-muted shrink-0 text-right pr-2">
                <span className="text-accent-olive font-semibold">{t('knowledge.toc.intro')}</span>
                <span className="hover:text-text-secondary transition-colors cursor-pointer">{t('knowledge.toc.principles')}</span>
                <span className="hover:text-text-secondary transition-colors cursor-pointer">{t('knowledge.toc.process')}</span>
                <span className="hover:text-text-secondary transition-colors cursor-pointer">{t('knowledge.toc.resources')}</span>
              </div>
            </div>
          </div>

          {/* Embedded custom rich-text NoteEditor */}
          <div className="min-h-[420px]">
            <NoteEditor
              key={note.id}
              initialContentJSON={note.contentJSON}
              noteId={note.id}
              title={titleDraft}
              onTitleChange={handleTitleChange}
              onDraftChange={markEditorDraft}
              onDraftSaved={markEditorDraftSaved}
              onSave={handleSave}
              isReadOnly={isTrash}
              expectedRevision={noteWriter.isRevisionLocked ? noteWriter.revision : (note?.revision ?? noteWriter.revision)}
              lastSavedAt={note.updatedAt}
              placeholder={tx("Начните писать... Введите '/' для выбора блоков")}
              autoFocus={false}
              className="border-0 bg-transparent shadow-none p-0"
            />
          </div>
        </div>
      </div>

      {/* Entity Linker Dialog ("Связать") */}
      {isLinkerOpen && (
        <EntityLinker
          sourceType="note"
          sourceId={note.id}
          open={isLinkerOpen}
          onOpenChange={setIsLinkerOpen}
        />
      )}

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={isPermanentAlertOpen} onOpenChange={setIsPermanentAlertOpen}>
        <DialogContent className="max-w-md bg-bg-surface border-border">
          <DialogHeader>
            <div className="flex items-center gap-2 text-accent-red mb-1">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>{tx("Permanently Delete Note?")}</DialogTitle>
            </div>
            <DialogDescription>
              {tx("Are you sure you want to permanently delete “")}<strong className="text-text-primary">{note.title || tx('Untitled Note')}</strong>
              {tx("”? This action cannot be reversed.")}</DialogDescription>
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
              onClick={handlePermanentDelete}
              disabled={isDeleting}
            >
              {isDeleting ? tx("Deleting...") : tx("Delete Permanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
