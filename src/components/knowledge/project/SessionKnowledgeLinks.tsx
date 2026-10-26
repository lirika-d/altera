import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Note, Resource } from '@/types'
import {
  FileText,
  Globe,
  Code,
  Paperclip,
  Plus,
  Link2,
  Unlink,
  ExternalLink,
  Edit2,
  Sparkles,
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

export interface SessionKnowledgeLinksProps {
  sessionId: string
  projectId?: string
  sessionTitle?: string
  className?: string
  compact?: boolean
}

export function SessionKnowledgeLinks({
  sessionId,
  projectId,
  sessionTitle,
  className,
  compact = false,
}: SessionKnowledgeLinksProps) {
  const { tx } = useTranslation()
  const { createNote, createEntityLink, deleteEntityLink } = useKnowledgeActions()

  // State
  const [isLinkerOpen, setIsLinkerOpen] = React.useState(false)
  const [isCreatingNote, setIsCreatingNote] = React.useState(false)
  const [selectedNote, setSelectedNote] = React.useState<Note | null>(null)
  const [selectedResource, setSelectedResource] = React.useState<Resource | null>(null)
  const [unlinkingLinkId, setUnlinkingLinkId] = React.useState<string | null>(null)

  // Fetch session data if needed
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])

  // Query entity links for this session
  const linksResult = useEntityLinks('session', sessionId)
  const allLinks = linksResult.all

  // Collect linked note IDs
  const linkedNoteData = React.useMemo(() => {
    const list: { linkId: string; noteId: string }[] = []
    for (const link of allLinks) {
      if (link.sourceType === 'session' && link.targetType === 'note') {
        list.push({ linkId: link.id, noteId: link.targetId })
      } else if (link.targetType === 'session' && link.sourceType === 'note') {
        list.push({ linkId: link.id, noteId: link.sourceId })
      }
    }
    return list
  }, [allLinks])

  // Collect linked resource IDs
  const linkedResourceData = React.useMemo(() => {
    const list: { linkId: string; resourceId: string }[] = []
    for (const link of allLinks) {
      if (link.sourceType === 'session' && link.targetType === 'resource') {
        list.push({ linkId: link.id, resourceId: link.targetId })
      } else if (link.targetType === 'session' && link.sourceType === 'resource') {
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

  // Query actual note and resource objects
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

  // Create a note pre-titled with session title and linked to project and session
  const handleCreateSessionNote = async () => {
    setIsCreatingNote(true)
    try {
      const effectiveTitle =
        sessionTitle || session?.title || 'Focus Sprint'
      const noteTitle = `Session Notes — ${effectiveTitle}`
      const effectiveProjectId = projectId || session?.projectId

      const initialDoc = createEmptyDoc()
      const newNote = await createNote({
        title: noteTitle,
        projectId: effectiveProjectId,
        contentJSON: JSON.stringify(initialDoc),
        plainText: '',
      })

      // Link newly created note to the session
      await createEntityLink('session', sessionId, 'note', newNote.id)

      // Open immediately for editing
      setSelectedNote(newNote)
    } catch (err) {
      console.error('Failed to create session note:', err)
    } finally {
      setIsCreatingNote(false)
    }
  }

  // Handle Unlinking
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
        compact ? 'p-2.5 space-y-2' : 'p-4 space-y-3',
        className
      )}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-purple/15 text-accent-purple border border-accent-purple/20">
            <BookOpen className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <span>{tx("Session Notes & Knowledge")}</span>
              {totalCount > 0 && (
                <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle">
                  {totalCount}
                </span>
              )}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setIsLinkerOpen(true)}
            className="gap-1 text-[11px] h-6 px-2"
            title={tx("Attach or link existing note/resource")}
          >
            <Link2 className="h-3 w-3" />
            <span>{tx("Link Note")}</span>
          </Button>

          <Button
            type="button"
            size="xs"
            onClick={handleCreateSessionNote}
            disabled={isCreatingNote}
            className="gap-1 text-[11px] h-6 px-2 shadow-sm"
            title={tx("Create a dedicated note linked to this session")}
          >
            <Plus className="h-3 w-3" />
            <span>{isCreatingNote ? tx("Creating…") : tx("Create Session Note")}</span>
          </Button>
        </div>
      </div>

      {/* Linked Content Body */}
      {totalCount > 0 ? (
        <div className="space-y-2 pt-1">
          {/* Notes list */}
          {linkedNotes.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {tx("Notes (")}{linkedNotes.length})
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {linkedNotes.map((note) => {
                  const link = linkedNoteData.find((d) => d.noteId === note.id)
                  const isUnlinking = link ? unlinkingLinkId === link.linkId : false

                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      className="group flex items-center justify-between gap-2.5 p-2 rounded-lg border border-border bg-bg-base/70 hover:bg-bg-elevated hover:border-border/90 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-3.5 w-3.5 text-accent-purple shrink-0" />
                        <span className="text-xs font-medium text-text-primary truncate">
                          {note.title || 'Untitled Note'}
                        </span>
                        {note.plainText && (
                          <span className="text-[11px] text-text-muted truncate hidden sm:inline">
                            — {note.plainText.slice(0, 60)}
                          </span>
                        )}
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
                          className="h-6 px-1.5 text-text-muted hover:text-text-primary text-[10px] gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>{tx("Open")}</span>
                        </Button>

                        {link && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={(e) => handleUnlink(e, link.linkId)}
                            disabled={isUnlinking}
                            className="h-6 w-6 p-0 text-text-muted hover:text-accent-red"
                            title={tx("Unlink from session")}
                          >
                            <Unlink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Resources list */}
          {linkedResources.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {tx("Resources & Snippets (")}{linkedResources.length})
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {linkedResources.map((resource) => {
                  const link = linkedResourceData.find((d) => d.resourceId === resource.id)
                  const isUnlinking = link ? unlinkingLinkId === link.linkId : false

                  const IconComponent =
                    resource.type === 'link'
                      ? Globe
                      : resource.type === 'snippet'
                      ? Code
                      : Paperclip

                  const iconColor =
                    resource.type === 'link'
                      ? 'text-accent-blue'
                      : resource.type === 'snippet'
                      ? 'text-accent-purple'
                      : 'text-accent-amber'

                  return (
                    <div
                      key={resource.id}
                      onClick={() => setSelectedResource(resource)}
                      className="group flex items-center justify-between gap-2.5 p-2 rounded-lg border border-border bg-bg-base/70 hover:bg-bg-elevated hover:border-border/90 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <IconComponent className={cn('h-3.5 w-3.5 shrink-0', iconColor)} />
                        <span className="text-xs font-medium text-text-primary truncate">
                          {resource.title || 'Untitled Resource'}
                        </span>
                        {resource.url && (
                          <span className="text-[10px] font-mono text-text-muted truncate hidden sm:inline">
                            {resource.url}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {resource.type === 'link' && sanitizeResourceUrl(resource.url) && (
                          <a
                            href={sanitizeResourceUrl(resource.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 inline-flex items-center justify-center rounded text-text-muted hover:text-accent-blue"
                            title={tx("Open external URL")}
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
                            disabled={isUnlinking}
                            className="h-6 w-6 p-0 text-text-muted hover:text-accent-red"
                            title={tx("Unlink from session")}
                          >
                            <Unlink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="py-3 px-3 rounded-lg border border-dashed border-border-subtle bg-bg-base/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-blue shrink-0" />
            <p className="text-xs text-text-secondary">
              {tx("No notes or resources attached to this session yet.")}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setIsLinkerOpen(true)}
              className="text-[11px] h-6 px-2"
            >
              <Link2 className="h-3 w-3 mr-1" />
              <span>{tx("Link Note")}</span>
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={handleCreateSessionNote}
              disabled={isCreatingNote}
              className="text-[11px] h-6 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              <span>{tx("Create Session Note")}</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── MODALS & DIALOGS ── */}

      {/* 1. Entity Linker Modal */}
      <EntityLinker
        sourceType="session"
        sourceId={sessionId}
        open={isLinkerOpen}
        onOpenChange={setIsLinkerOpen}
      />

      {/* 2. Note Detail / Canvas Dialog */}
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

      {/* 3. Resource Detail Modal */}
      <ResourceDetailModal
        resource={selectedResource}
        open={!!selectedResource}
        onOpenChange={(open) => !open && setSelectedResource(null)}
        onDelete={() => setSelectedResource(null)}
      />
    </div>
  )
}
