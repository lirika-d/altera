import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { normalizeTagName } from '@/db/knowledge'
import { useTags, useKnowledgeActions } from '@/hooks/useKnowledge'
import type { Tag } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Tag as TagIcon,
  Search,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Palette,
  Loader2,
} from 'lucide-react'
import { TAG_COLOR_PALETTE, DEFAULT_TAG_COLOR, getTagColorOption } from './tagColors'
import { useTranslation } from '@/i18n'

export interface TagManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTagDeleted?: (tagId: string) => void
}

const EMPTY_USAGE_COUNTS = Object.create(null) as Record<string, number>

/**
 * TagManagerDialog — Dialog to view all workspace tags with entity usage counts,
 * edit tag name/color, and delete tags with confirmation.
 */
export function TagManagerDialog({
  open,
  onOpenChange,
  onTagDeleted,
}: TagManagerDialogProps) {
  const { tx } = useTranslation()
  const rawTags = useTags()
  const tags = React.useMemo(() => rawTags ?? [], [rawTags])
  const { createTag, deleteTag } = useKnowledgeActions()

  // Reactively calculate usage counts for all tags
  const usageCounts = useLiveQuery(async () => {
    const assignments = await db.tagAssignments.toArray()
    const counts = Object.create(null) as Record<string, number>
    for (const a of assignments) {
      counts[a.tagId] = (counts[a.tagId] || 0) + 1
    }
    return counts
  }, []) ?? EMPTY_USAGE_COUNTS

  // Local state for search & creation
  const [search, setSearch] = React.useState('')
  const [newTagName, setNewTagName] = React.useState('')
  const [newTagColor, setNewTagColor] = React.useState(DEFAULT_TAG_COLOR)
  const [isCreating, setIsCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  // State for editing a tag
  const [editingTagId, setEditingTagId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editColor, setEditColor] = React.useState(DEFAULT_TAG_COLOR)
  const [editError, setEditError] = React.useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)

  // State for delete confirmation
  const [deletingTagId, setDeletingTagId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Reset states on dialog close
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
    if (!newOpen) {
      setSearch('')
      setNewTagName('')
      setEditingTagId(null)
      setDeletingTagId(null)
      setCreateError(null)
      setEditError(null)
    }
  }

  // Filter tags by search
  const filteredTags = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tags
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.normalizedName.includes(q)
    )
  }, [tags, search])

  // Create Tag Action
  const handleCreateTag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newTagName.trim()
    if (!trimmed) return

    setCreateError(null)
    setIsCreating(true)

    try {
      await createTag({
        name: trimmed,
        color: newTagColor,
      })
      setNewTagName('')
      setNewTagColor(DEFAULT_TAG_COLOR)
    } catch {
      console.error('Tag creation failed')
      setCreateError(tx('Failed to create tag'))
    } finally {
      setIsCreating(false)
    }
  }

  // Start Edit Mode
  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color || DEFAULT_TAG_COLOR)
    setEditError(null)
    setDeletingTagId(null)
  }

  // Save Tag Edit
  const handleSaveEdit = async (tag: Tag) => {
    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError(tx('Tag name cannot be empty'))
      return
    }

    const normalized = normalizeTagName(trimmed)
    const duplicate = tags.find(
      (t) => t.id !== tag.id && t.normalizedName === normalized
    )

    if (duplicate) {
      setEditError(tx('A tag with this name already exists'))
      return
    }

    setIsSavingEdit(true)
    setEditError(null)

    try {
      await db.tags.update(tag.id, {
        name: trimmed,
        normalizedName: normalized,
        color: editColor,
      })
      setEditingTagId(null)
    } catch {
      console.error('Tag update failed')
      setEditError(tx('Failed to update tag'))
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Confirm Delete Tag
  const handleConfirmDelete = async (tagId: string) => {
    setIsDeleting(true)
    try {
      await deleteTag(tagId)
      onTagDeleted?.(tagId)
      setDeletingTagId(null)
    } catch (err) {
      console.error('Failed to delete tag:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden sm:rounded-xl">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
              <TagIcon className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-sm font-semibold text-text-primary">
                {tx("Workspace Tags")}</DialogTitle>
              <DialogDescription className="text-xs text-text-muted">
                {tx("Manage tags, customize colors, and see entity usage counts across the workspace.")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Create Tag Bar */}
        <div className="p-3 bg-bg-base/60 border-b border-border-subtle">
          <form onSubmit={handleCreateTag} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={newTagName}
                onChange={(e) => {
                  setNewTagName(e.target.value)
                  setCreateError(null)
                }}
                placeholder={tx("New tag name...")}
                className="h-7 text-xs flex-1 bg-bg-surface"
              />
              <Button
                type="submit"
                size="xs"
                disabled={!newTagName.trim() || isCreating}
                className="h-7 text-xs gap-1 shrink-0"
              >
                {isCreating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                <span>{tx("Add Tag")}</span>
              </Button>
            </div>

            {/* Quick Color Palette Selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-text-muted flex items-center gap-1">
                <Palette className="h-2.5 w-2.5" /> {tx("Color:")}</span>
              <div className="flex items-center gap-1">
                {TAG_COLOR_PALETTE.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNewTagColor(c.color)}
                    className={cn(
                      'h-4 w-4 rounded-full border transition-all',
                      newTagColor === c.color ? 'ring-2 ring-accent-blue scale-110' : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: c.color }}
                    title={tx(c.name)}
                  />
                ))}
              </div>
            </div>

            {createError && (
              <p className="text-[11px] text-accent-red flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {createError}
              </p>
            )}
          </form>
        </div>

        {/* Filter Input */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx("Search existing tags...")}
              className="h-7 pl-8 pr-7 text-xs bg-bg-surface"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-text-muted hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <span className="text-xs text-text-muted shrink-0 font-mono">
            {filteredTags.length} {filteredTags.length === 1 ? tx("tag") : filteredTags.length < 5 ? tx("tagsFew") : tx("tags")}
          </span>
        </div>

        {/* Tags List */}
        <div className="max-h-72 overflow-y-auto px-3 pb-3 space-y-1.5">
          {filteredTags.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              {search ? tx("No tags match your search.") : tx("No tags created yet.")}
            </div>
          ) : (
            filteredTags.map((tag) => {
              const count = usageCounts[tag.id] || 0
              const isEditing = editingTagId === tag.id
              const isDeletingThis = deletingTagId === tag.id
              const colorOpt = getTagColorOption(isEditing ? editColor : tag.color)

              if (isEditing) {
                return (
                  <div
                    key={tag.id}
                    className="rounded-lg border border-accent-blue/30 bg-accent-blue/5 p-2 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value)
                          setEditError(null)
                        }}
                        placeholder={tx("Tag name")}
                        className="h-7 text-xs flex-1 bg-bg-surface"
                        autoFocus
                      />
                      <Button
                        size="xs"
                        variant="default"
                        disabled={isSavingEdit || !editName.trim()}
                        onClick={() => handleSaveEdit(tag)}
                        className="h-7 text-xs gap-1"
                      >
                        {isSavingEdit ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        <span>{tx("Save")}</span>
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditingTagId(null)}
                        className="h-7 text-xs"
                      >
                        {tx("Cancel")}</Button>
                    </div>

                    {/* Color swatches in edit mode */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-text-muted">{tx("Pick color:")}</span>
                      <div className="flex items-center gap-1">
                        {TAG_COLOR_PALETTE.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setEditColor(c.color)}
                            className={cn(
                              'h-4 w-4 rounded-full border transition-all',
                              editColor === c.color ? 'ring-2 ring-accent-blue scale-110' : 'hover:scale-105'
                            )}
                            style={{ backgroundColor: c.color }}
                            title={tx(c.name)}
                          />
                        ))}
                      </div>
                    </div>

                    {editError && (
                      <p className="text-[11px] text-accent-red flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {editError}
                      </p>
                    )}
                  </div>
                )
              }

              if (isDeletingThis) {
                return (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between rounded-lg border border-accent-red/30 bg-accent-red/10 p-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-accent-red min-w-0 mr-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {tx("Delete")} <strong>#{tag.name}</strong>{tx("? Removes from")} {count} {count === 1 ? tx('entity') : count < 5 ? tx('entitiesFew') : tx('entities')}.
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="xs"
                        variant="danger"
                        disabled={isDeleting}
                        onClick={() => handleConfirmDelete(tag.id)}
                        className="h-6 text-[11px]"
                      >
                        {isDeleting ? tx("Deleting...") : tx("Delete")}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setDeletingTagId(null)}
                        className="h-6 text-[11px]"
                      >
                        {tx("Cancel")}</Button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={tag.id}
                  className="group flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-xs hover:border-border hover:bg-bg-elevated/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: colorOpt.color }}
                    />
                    <span className="font-medium text-text-primary truncate">
                      #{tag.name}
                    </span>
                    <Badge
                      variant="subtle"
                      className="text-[10px] px-1.5 py-0 h-4 font-mono text-text-muted"
                      title={`${count} entities tagged with #${tag.name}`}
                    >
                      {count} {count === 1 ? tx("entity") : tx("entities")}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(tag)}
                      className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                      title={tx("Edit tag name & color")}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingTagId(tag.id)
                        setEditingTagId(null)
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                      title={tx("Delete tag")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
