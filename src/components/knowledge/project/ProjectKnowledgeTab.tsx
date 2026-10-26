import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import type { Note, Resource, Attachment, ResourceType } from '@/types'
import {
  FileText,
  Globe,
  Paperclip,
  Plus,
  ExternalLink,
  BookOpen,
  Link2,
  UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { NoteCard, NoteDetail, CreateNoteDialog } from '@/components/knowledge/notes'
import {
  ResourceCard,
  CreateResourceDialog,
  EditResourceDialog,
  ResourceDetailModal,
} from '@/components/knowledge/resources'
import {
  AttachmentItem,
  AttachmentPreviewDialog,
} from '@/components/knowledge/attachments'
import { downloadAttachment } from '@/lib/attachments'
import { EntityLinker } from '@/components/knowledge/relationships'
import {
  useNotes,
  useResources,
  useEntityLinks,
  useKnowledgeActions,
} from '@/hooks/useKnowledge'
import { useProject } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

export interface ProjectKnowledgeTabProps {
  projectId: string
  className?: string
}

export function ProjectKnowledgeTab({ projectId, className }: ProjectKnowledgeTabProps) {
  const { tx } = useTranslation()
  const navigate = useNavigate()
  const project = useProject(projectId)
  const { deleteAttachment } = useKnowledgeActions()

  // Modals & Dialog state
  const [isCreateNoteOpen, setIsCreateNoteOpen] = React.useState(false)
  const [isCreateResourceOpen, setIsCreateResourceOpen] = React.useState(false)
  const [initialResourceType, setInitialResourceType] = React.useState<ResourceType>('link')
  const [isEntityLinkerOpen, setIsEntityLinkerOpen] = React.useState(false)

  // Selected entities for detail/editing modals
  const [selectedNote, setSelectedNote] = React.useState<Note | null>(null)
  const [selectedResource, setSelectedResource] = React.useState<Resource | null>(null)
  const [editingResource, setEditingResource] = React.useState<Resource | null>(null)
  const [previewAttachment, setPreviewAttachment] = React.useState<Attachment | null>(null)

  // Active query for all notes, resources, and entity links
  const allNotes = useNotes()
  const allResources = useResources()
  const projectLinksResult = useEntityLinks('project', projectId)
  const allLinks = projectLinksResult.all

  // Compute Project Notes: where note.projectId === projectId OR linked via EntityLink
  const projectNotes = React.useMemo(() => {
    const linkedNoteIds = new Set(
      allLinks
        .filter(
          (l) =>
            (l.sourceType === 'note' && l.targetType === 'project' && l.targetId === projectId) ||
            (l.targetType === 'note' && l.sourceType === 'project' && l.sourceId === projectId)
        )
        .map((l) => (l.sourceType === 'note' ? l.sourceId : l.targetId))
    )

    return allNotes.filter(
      (n) => !n.deletedAt && (n.projectId === projectId || linkedNoteIds.has(n.id))
    )
  }, [allNotes, allLinks, projectId])

  // Compute Project Resources: where resource.projectId === projectId OR linked via EntityLink
  const projectResources = React.useMemo(() => {
    const linkedResourceIds = new Set(
      allLinks
        .filter(
          (l) =>
            (l.sourceType === 'resource' && l.targetType === 'project' && l.targetId === projectId) ||
            (l.targetType === 'resource' && l.sourceType === 'project' && l.sourceId === projectId)
        )
        .map((l) => (l.sourceType === 'resource' ? l.sourceId : l.targetId))
    )

    return allResources.filter(
      (r) => !r.deletedAt && (r.projectId === projectId || linkedResourceIds.has(r.id))
    )
  }, [allResources, allLinks, projectId])

  // Collect all attachment IDs linked to project resources
  const attachmentIds = React.useMemo(() => {
    const ids = new Set<string>()
    projectResources.forEach((r) => {
      if (r.attachmentId) ids.add(r.attachmentId)
    })
    return Array.from(ids)
  }, [projectResources])

  // Query actual attachments from Dexie
  const projectAttachments = useLiveQuery(
    async () => {
      if (attachmentIds.length === 0) return []
      return db.attachments.where('id').anyOf(attachmentIds).toArray()
    },
    [attachmentIds.join(',')]
  ) ?? []

  const handleOpenKnowledgeHub = () => {
    navigate(`/knowledge?project=${projectId}`)
  }

  const handleAddFileResource = () => {
    setInitialResourceType('file')
    setIsCreateResourceOpen(true)
  }

  const handleAddGeneralResource = () => {
    setInitialResourceType('link')
    setIsCreateResourceOpen(true)
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    await deleteAttachment(attachmentId)
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* ── TOP ACTION BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-bg-surface shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue border border-accent-blue/20 shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text-primary tracking-wide flex items-center gap-2">
              <span>{tx("Project Knowledge Hub")}</span>
              {project && (
                <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle">
                  {project.identifier}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-text-secondary">
              {tx("Centralized documentation, snippets, and assets tied to this project.")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEntityLinkerOpen(true)}
            className="gap-1.5 text-xs h-7"
            title={tx("Link existing global notes or resources to this project")}
          >
            <Link2 className="h-3 w-3" />
            <span>{tx("Link Existing")}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleAddGeneralResource}
            className="gap-1.5 text-xs h-7"
          >
            <Plus className="h-3 w-3" />
            <span>{tx("Add Resource")}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateNoteOpen(true)}
            className="gap-1.5 text-xs h-7 shadow-sm"
          >
            <Plus className="h-3 w-3" />
            <span>{tx("New Project Note")}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleOpenKnowledgeHub}
            className="gap-1.5 text-xs h-7 text-accent-blue hover:text-accent-blue hover:bg-accent-blue/10"
            title={tx("Open in full Knowledge Hub workspace")}
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden md:inline">{tx("Open in Knowledge Hub")}</span>
          </Button>
        </div>
      </div>

      {/* ── STATS SUMMARY STRIP ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-bg-surface flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] text-text-muted font-medium">{tx("Project Notes")}</span>
            <div className="font-mono text-lg font-semibold text-text-primary">
              {projectNotes.length}
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
            <FileText className="h-4 w-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-bg-surface flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] text-text-muted font-medium">{tx("Resources & Links")}</span>
            <div className="font-mono text-lg font-semibold text-text-primary">
              {projectResources.length}
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
            <Globe className="h-4 w-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-bg-surface flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] text-text-muted font-medium">{tx("Total Files")}</span>
            <div className="font-mono text-lg font-semibold text-text-primary">
              {projectAttachments.length}
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
            <Paperclip className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* ── SECTION 1: PROJECT NOTES ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent-purple" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              {tx("Project Notes")}</h3>
            <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle">
              {projectNotes.length}
            </span>
          </div>

          <Button
            size="xs"
            variant="ghost"
            onClick={() => setIsCreateNoteOpen(true)}
            className="gap-1 text-xs text-text-muted hover:text-text-primary h-6"
          >
            <Plus className="h-3 w-3" />
            <span>{tx("New Note")}</span>
          </Button>
        </div>

        {projectNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                showProject={false}
                onClick={() => setSelectedNote(note)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface/50 p-6 text-center space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated border border-border text-text-muted mx-auto">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">{tx("No project notes yet")}</p>
              <p className="text-[11px] text-text-secondary mt-0.5 max-w-sm mx-auto">
                {tx("Write technical specifications, architecture decisions, meeting notes, or ideas specifically for this project.")}</p>
            </div>
            <Button
              size="xs"
              onClick={() => setIsCreateNoteOpen(true)}
              className="gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              <span>{tx("Create First Note")}</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── SECTION 2: PROJECT RESOURCES & LINKS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent-blue" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              {tx("Project Resources & Snippets")}</h3>
            <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle">
              {projectResources.length}
            </span>
          </div>

          <Button
            size="xs"
            variant="ghost"
            onClick={handleAddGeneralResource}
            className="gap-1 text-xs text-text-muted hover:text-text-primary h-6"
          >
            <Plus className="h-3 w-3" />
            <span>{tx("Add Resource")}</span>
          </Button>
        </div>

        {projectResources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                showProject={false}
                onSelect={(res) => setSelectedResource(res)}
                onEdit={(res) => setEditingResource(res)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface/50 p-6 text-center space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated border border-border text-text-muted mx-auto">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">{tx("No resources saved yet")}</p>
              <p className="text-[11px] text-text-secondary mt-0.5 max-w-sm mx-auto">
                {tx("Bookmark API docs, GitHub repos, external tools, or save code snippets frequently used in this project.")}</p>
            </div>
            <Button
              size="xs"
              onClick={handleAddGeneralResource}
              className="gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              <span>{tx("Add Resource")}</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── SECTION 3: PROJECT FILES & ATTACHMENTS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-accent-amber" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              {tx("Project Files & Attachments")}</h3>
            <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle">
              {projectAttachments.length}
            </span>
          </div>

          <Button
            size="xs"
            variant="ghost"
            onClick={handleAddFileResource}
            className="gap-1 text-xs text-text-muted hover:text-text-primary h-6"
          >
            <UploadCloud className="h-3 w-3" />
            <span>{tx("Upload File")}</span>
          </Button>
        </div>

        {projectAttachments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {projectAttachments.map((attachment) => (
              <AttachmentItem
                key={attachment.id}
                attachment={attachment}
                onPreview={(att) => setPreviewAttachment(att)}
                onDownload={(att) => downloadAttachment(att)}
                onDelete={handleDeleteAttachment}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface/50 p-6 text-center space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated border border-border text-text-muted mx-auto">
              <Paperclip className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">{tx("No attached files")}</p>
              <p className="text-[11px] text-text-secondary mt-0.5 max-w-sm mx-auto">
                {tx("Upload PDFs, diagrams, archives, or datasets to store them offline inside your local browser database.")}</p>
            </div>
            <Button
              size="xs"
              onClick={handleAddFileResource}
              className="gap-1 text-xs"
            >
              <UploadCloud className="h-3 w-3" />
              <span>{tx("Upload First File")}</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── MODALS & DIALOGS ── */}

      {/* 1. Quick Create Note */}
      <CreateNoteDialog
        open={isCreateNoteOpen}
        onOpenChange={setIsCreateNoteOpen}
        initialProjectId={projectId}
        onCreated={(newNote) => setSelectedNote(newNote)}
      />

      {/* 2. Quick Create Resource */}
      <CreateResourceDialog
        open={isCreateResourceOpen}
        onOpenChange={setIsCreateResourceOpen}
        initialProjectId={projectId}
        initialType={initialResourceType}
        onSuccess={(newResource) => setSelectedResource(newResource)}
      />

      {/* 3. Link Existing Entity to Project */}
      <EntityLinker
        sourceType="project"
        sourceId={projectId}
        open={isEntityLinkerOpen}
        onOpenChange={setIsEntityLinkerOpen}
      />

      {/* 4. Note Detail / Canvas Dialog */}
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

      {/* 5. Resource Detail Modal */}
      <ResourceDetailModal
        resource={selectedResource}
        open={!!selectedResource}
        onOpenChange={(open) => !open && setSelectedResource(null)}
        onEdit={(res) => {
          setSelectedResource(null)
          setEditingResource(res)
        }}
        onDelete={() => setSelectedResource(null)}
      />

      {/* 6. Edit Resource Dialog */}
      <EditResourceDialog
        resource={editingResource}
        open={!!editingResource}
        onOpenChange={(open) => !open && setEditingResource(null)}
        onSuccess={() => setEditingResource(null)}
      />

      {/* 7. Attachment Preview Dialog */}
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        open={!!previewAttachment}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
        onDownload={(att) => downloadAttachment(att)}
      />
    </div>
  )
}
