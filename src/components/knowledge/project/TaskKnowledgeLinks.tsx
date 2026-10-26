import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Note, Resource } from '@/types'
import {
  FileText,
  Globe,
  Plus,
  Link2,
  Unlink,
  ExternalLink,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { NoteDetail } from '@/components/knowledge/notes'
import { ResourceDetailModal } from '@/components/knowledge/resources'
import { EntityLinker } from '@/components/knowledge/relationships'
import { useEntityLinks, useKnowledgeActions } from '@/hooks/useKnowledge'
import { createEmptyDoc } from '@/components/knowledge/editor'
import { cn } from '@/lib/utils'
import { sanitizeResourceUrl } from '@/lib/resourceUrl'
import { useTranslation } from '@/i18n'

export interface TaskKnowledgeLinksProps {
  taskId: string
  projectId?: string
  taskTitle?: string
  className?: string
  compact?: boolean
}

export function TaskKnowledgeLinks({
  taskId,
  projectId,
  taskTitle,
  className,
  compact = false,
}: TaskKnowledgeLinksProps) {
  const { tx } = useTranslation()
  const { createNote, createEntityLink, deleteEntityLink } = useKnowledgeActions()

  const [isLinkerOpen, setIsLinkerOpen] = React.useState(false)
  const [isCreatingNote, setIsCreatingNote] = React.useState(false)
  const [selectedNote, setSelectedNote] = React.useState<Note | null>(null)
  const [selectedResource, setSelectedResource] = React.useState<Resource | null>(null)
  const [unlinkingLinkId, setUnlinkingLinkId] = React.useState<string | null>(null)

  // Fetch task from DB if taskTitle not provided
  const task = useLiveQuery(() => db.tasks.get(taskId), [taskId])

  // Query entity links for this task
  const linksResult = useEntityLinks('task', taskId)
  const allLinks = linksResult.all

  const linkedNoteData = React.useMemo(() => {
    const list: { linkId: string; noteId: string }[] = []
    for (const link of allLinks) {
      if (link.sourceType === 'task' && link.targetType === 'note') {
        list.push({ linkId: link.id, noteId: link.targetId })
      } else if (link.targetType === 'task' && link.sourceType === 'note') {
        list.push({ linkId: link.id, noteId: link.sourceId })
      }
    }
    return list
  }, [allLinks])

  const linkedResourceData = React.useMemo(() => {
    const list: { linkId: string; resourceId: string }[] = []
    for (const link of allLinks) {
      if (link.sourceType === 'task' && link.targetType === 'resource') {
        list.push({ linkId: link.id, resourceId: link.targetId })
      } else if (link.targetType === 'task' && link.sourceType === 'resource') {
        list.push({ linkId: link.id, resourceId: link.sourceId })
      }
    }
    return list
  }, [allLinks])

  const noteIds = React.useMemo(() => linkedNoteData.map((d) => d.noteId), [linkedNoteData])
  const resourceIds = React.useMemo(
    () => linkedResourceData.map((d) => d.resourceId),
    [linkedResourceData]
  )

  const linkedNotes = useLiveQuery(
    async () => {
      if (noteIds.length === 0) return []
      const notes = await db.notes.where('id').anyOf(noteIds).toArray()
      return notes.filter((n) => !n.deletedAt)
    },
    [noteIds.join(',')]
  ) ?? []

  const linkedResources = useLiveQuery(
    async () => {
      if (resourceIds.length === 0) return []
      const resources = await db.resources.where('id').anyOf(resourceIds).toArray()
      return resources.filter((r) => !r.deletedAt)
    },
    [resourceIds.join(',')]
  ) ?? []

  const totalCount = linkedNotes.length + linkedResources.length

  const handleCreateTaskNote = async () => {
    setIsCreatingNote(true)
    try {
      const effectiveTitle = taskTitle || task?.title || 'Task'
      const noteTitle = `Task Notes — ${effectiveTitle}`
      const effectiveProjectId = projectId || task?.projectId

      const initialDoc = createEmptyDoc()
      const newNote = await createNote({
        title: noteTitle,
        projectId: effectiveProjectId,
        contentJSON: JSON.stringify(initialDoc),
        plainText: '',
      })

      // Link newly created note to the task
      await createEntityLink('task', taskId, 'note', newNote.id)

      setSelectedNote(newNote)
    } catch (err) {
      console.error('Failed to create task note:', err)
    } finally {
      setIsCreatingNote(false)
    }
  }

  const handleUnlink = async (e: React.MouseEvent, linkId?: string) => {
    e.stopPropagation()
    if (!linkId) return
    try {
      setUnlinkingLinkId(linkId)
      await deleteEntityLink(linkId)
    } catch (err) {
      console.error('Failed to unlink entity:', err)
    } finally {
      setUnlinkingLinkId(null)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-bg-surface shadow-sm',
        compact ? 'p-2 space-y-2' : 'p-3.5 space-y-3',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-accent-green" />
          <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <span>{tx("Linked Notes & Resources")}</span>
            {totalCount > 0 && (
              <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle">
                {totalCount}
              </span>
            )}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setIsLinkerOpen(true)}
            className="gap-1 text-[11px] h-6 px-2"
          >
            <Link2 className="h-3 w-3" />
            <span>{tx("Link Note")}</span>
          </Button>

          <Button
            type="button"
            size="xs"
            onClick={handleCreateTaskNote}
            disabled={isCreatingNote}
            className="gap-1 text-[11px] h-6 px-2 shadow-sm"
          >
            <Plus className="h-3 w-3" />
            <span>{isCreatingNote ? tx("Creating…") : tx("New Note")}</span>
          </Button>
        </div>
      </div>

      {totalCount > 0 ? (
        <div className="space-y-1.5">
          {linkedNotes.map((note) => {
            const link = linkedNoteData.find((d) => d.noteId === note.id)
            return (
              <div
                key={note.id}
                onClick={() => setSelectedNote(note)}
                className="group flex items-center justify-between gap-2 p-2 rounded border border-border bg-bg-base/70 hover:bg-bg-elevated transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-3.5 w-3.5 text-accent-purple shrink-0" />
                  <span className="text-xs font-medium text-text-primary truncate">
                    {note.title || 'Untitled Note'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedNote(note)
                    }}
                    className="h-5 px-1.5 text-text-muted hover:text-text-primary text-[10px]"
                  >
                    {tx("Open")}</Button>

                  {link && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={(e) => handleUnlink(e, link.linkId)}
                      disabled={unlinkingLinkId === link.linkId}
                      className="h-5 w-5 p-0 text-text-muted hover:text-accent-red"
                      title={tx("Unlink")}
                    >
                      <Unlink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          {linkedResources.map((res) => {
            const link = linkedResourceData.find((d) => d.resourceId === res.id)
            const safeUrl = sanitizeResourceUrl(res.url)
            return (
              <div
                key={res.id}
                onClick={() => setSelectedResource(res)}
                className="group flex items-center justify-between gap-2 p-2 rounded border border-border bg-bg-base/70 hover:bg-bg-elevated transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Globe className="h-3.5 w-3.5 text-accent-blue shrink-0" />
                  <span className="text-xs font-medium text-text-primary truncate">
                    {res.title || 'Untitled Resource'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {safeUrl && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5 inline-flex items-center justify-center rounded text-text-muted hover:text-accent-blue"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {link && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={(e) => handleUnlink(e, link.linkId)}
                      disabled={unlinkingLinkId === link.linkId}
                      className="h-5 w-5 p-0 text-text-muted hover:text-accent-red"
                      title={tx("Unlink")}
                    >
                      <Unlink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-2.5 px-3 rounded-lg border border-dashed border-border-subtle bg-bg-base/40 flex items-center justify-between gap-2 text-xs text-text-muted">
          <span>{tx("No notes or resources linked to this task.")}</span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={handleCreateTaskNote}
            className="text-[11px] h-6 px-1.5 text-accent-blue hover:text-accent-blue"
          >
            <Plus className="h-3 w-3 mr-1" />
            <span>{tx("Create Note")}</span>
          </Button>
        </div>
      )}

      {/* Linker Dialog */}
      <EntityLinker
        sourceType="task"
        sourceId={taskId}
        open={isLinkerOpen}
        onOpenChange={setIsLinkerOpen}
      />

      {/* Note Detail Dialog */}
      <Dialog open={!!selectedNote} onOpenChange={(open) => !open && setSelectedNote(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          {selectedNote && (
            <NoteDetail
              noteId={selectedNote.id}
              initialNote={selectedNote}
              onBack={() => setSelectedNote(null)}
              onNoteDeleted={() => setSelectedNote(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Resource Detail Modal */}
      <ResourceDetailModal
        resource={selectedResource}
        open={!!selectedResource}
        onOpenChange={(open) => !open && setSelectedResource(null)}
        onDelete={() => setSelectedResource(null)}
      />
    </div>
  )
}
