import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import type { Tag, KnowledgeEntityType } from '@/types'
import {
  useTags,
  useEntityTags,
  useKnowledgeActions,
} from '@/hooks/useKnowledge'
import {
  Tag as TagIcon,
  Search,
  Plus,
  Check,
  Palette,
  Settings2,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { TAG_COLOR_PALETTE, DEFAULT_TAG_COLOR, getTagColorOption } from './tagColors'
import { useTranslation } from '@/i18n'

export interface TagPickerProps {
  entityType?: KnowledgeEntityType
  entityId?: string
  /** Controlled selected tag IDs (useful for new note/resource creation forms) */
  selectedTagIds?: string[]
  /** Callback fired when a tag is toggled */
  onTagToggle?: (tag: Tag, isAssigned: boolean) => void
  /** Custom trigger node */
  trigger?: React.ReactNode
  /** Popover placement alignment */
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  disabled?: boolean
  /** Callback to open TagManagerDialog */
  onOpenManageTags?: () => void
}

/**
 * TagPicker — Popover listing existing tags with search, assign/unassign toggles,
 * and a "Create Tag" palette.
 */
export function TagPicker({
  entityType,
  entityId,
  selectedTagIds,
  onTagToggle,
  trigger,
  align = 'start',
  side = 'bottom',
  className,
  disabled = false,
  onOpenManageTags,
}: TagPickerProps) {
  const { tx } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [isCreatingInline, setIsCreatingInline] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState('')
  const [selectedColor, setSelectedColor] = React.useState<string>(DEFAULT_TAG_COLOR)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const rawAllTags = useTags()
  const rawAssignedTags = useEntityTags(entityType || 'note', entityId)
  const { assignTag, removeTagAssignment, createTag } = useKnowledgeActions()

  // Calculate which tag IDs are currently active
  const activeTagIds = React.useMemo(() => {
    if (selectedTagIds !== undefined) {
      return new Set(selectedTagIds)
    }
    const tags = rawAssignedTags ?? []
    return new Set(tags.map((t) => t.id))
  }, [selectedTagIds, rawAssignedTags])

  // Filter existing tags based on search input
  const filteredTags = React.useMemo(() => {
    const tags = rawAllTags ?? []
    const q = search.trim().toLowerCase()
    if (!q) return tags
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.normalizedName.includes(q)
    )
  }, [rawAllTags, search])

  // Check if an exact tag name already exists
  const exactMatchExists = React.useMemo(() => {
    const tags = rawAllTags ?? []
    const q = search.trim().toLowerCase()
    if (!q) return true
    return tags.some((t) => t.normalizedName === q)
  }, [rawAllTags, search])

  // Reset state when popover closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setSearch('')
      setIsCreatingInline(false)
      setNewTagName('')
      setActionError(null)
    }
  }

  // Toggle tag assignment
  const handleToggleTag = async (tag: Tag) => {
    setActionError(null)
    const isCurrentlyAssigned = activeTagIds.has(tag.id)

    // Call external callback if provided
    onTagToggle?.(tag, !isCurrentlyAssigned)

    // If an entityId is provided, persist immediately
    if (entityType && entityId) {
      try {
        if (isCurrentlyAssigned) {
          await removeTagAssignment(tag.id, entityType, entityId)
        } else {
          await assignTag(tag.id, entityType, entityId)
        }
      } catch {
        console.error('Tag assignment update failed')
        setActionError(tx('Failed to update tag'))
      }
    }
  }

  // Create new tag from inline form or search
  const handleCreateTagSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const nameToCreate = (newTagName || search).trim()
    if (!nameToCreate) return

    setIsSubmitting(true)
    setActionError(null)

    try {
      const created = await createTag({
        name: nameToCreate,
        color: selectedColor,
      })

      // Notify consumer
      onTagToggle?.(created, true)

      // If entity exists, automatically assign newly created tag
      if (entityType && entityId) {
        await assignTag(created.id, entityType, entityId)
      }

      // Reset create UI
      setSearch('')
      setNewTagName('')
      setIsCreatingInline(false)
    } catch {
      console.error('Tag creation failed')
      setActionError(tx('Failed to create tag'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="outline"
            size="xs"
            className={cn(
              'h-6 gap-1 text-[11px] text-text-secondary hover:text-text-primary border-dashed border-border-subtle hover:border-border',
              className
            )}
          >
            <TagIcon className="h-3 w-3 text-text-muted" />
            <span>{tx("Add Tag")}</span>
          </Button>
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          side={side}
          sideOffset={5}
          className={cn(
            'z-50 w-64 rounded-lg border border-border bg-bg-surface p-2 shadow-2xl outline-none duration-150',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        >
          {/* Header & Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-text-muted" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setActionError(null)
              }}
              placeholder={tx("Search or create tag...")}
              className="h-7 pl-7 pr-7 text-xs bg-bg-base border-border-subtle focus-visible:ring-1"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-text-muted hover:text-text-primary"
                aria-label={tx("Clear search")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Action Error Banner */}
          {actionError && (
            <div className="mb-2 flex items-center gap-1.5 rounded bg-accent-red/10 border border-accent-red/20 px-2 py-1 text-[10px] text-accent-red">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">{actionError}</span>
            </div>
          )}

          {/* Inline Create Form Section */}
          {isCreatingInline ? (
            <div className="mb-2 rounded-md border border-border-subtle bg-bg-base/70 p-2 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-text-secondary">
                <span className="flex items-center gap-1">
                  <Palette className="h-3 w-3 text-accent-blue" />
                  <span>{tx("Create Tag")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingInline(false)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label={tx("Cancel create")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={tx("Tag name")}
                className="h-6 text-xs bg-bg-surface"
              />

              {/* Color Palette Swatches */}
              <div>
                <span className="block text-[10px] text-text-muted mb-1">{tx("Color Palette")}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {TAG_COLOR_PALETTE.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c.color)}
                      className={cn(
                        'flex h-6 items-center justify-center rounded border transition-all text-[10px]',
                        c.bgClass,
                        c.borderClass,
                        selectedColor === c.color ? 'ring-2 ring-accent-blue scale-105' : 'hover:opacity-80'
                      )}
                      title={tx(c.name)}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <Button
                size="xs"
                variant="default"
                disabled={!newTagName.trim() || isSubmitting}
                onClick={() => handleCreateTagSubmit()}
                className="w-full h-6 text-[11px] gap-1"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                <span>{tx("Save Tag")}</span>
              </Button>
            </div>
          ) : (
            <>
              {/* Quick Create Prompt if typed name not found */}
              {search.trim() && !exactMatchExists && (
                <div className="mb-2 pb-1 border-b border-border-subtle">
                  <button
                    type="button"
                    onClick={() => {
                      setNewTagName(search.trim())
                      setIsCreatingInline(true)
                    }}
                    className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-accent-blue hover:bg-accent-blue/10 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {tx("Create tag")} <strong className="font-semibold">"{search.trim()}"</strong>
                    </span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Tags List */}
          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredTags.length === 0 ? (
              <div className="py-4 text-center text-xs text-text-muted">
                {search ? tx("No matching tags found.") : tx("No tags yet in workspace.")}
              </div>
            ) : (
              filteredTags.map((tag) => {
                const isAssigned = activeTagIds.has(tag.id)
                const colorOpt = getTagColorOption(tag.color)

                return (
                  <div
                    key={tag.id}
                    onClick={() => handleToggleTag(tag)}
                    className={cn(
                      'flex items-center justify-between rounded px-2 py-1 text-xs cursor-pointer select-none transition-colors',
                      isAssigned
                        ? 'bg-accent-blue/10 text-text-primary'
                        : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        checked={isAssigned}
                        onCheckedChange={() => handleToggleTag(tag)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 rounded-sm"
                      />
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorOpt.color }}
                      />
                      <span className="truncate font-sans font-medium">#{tag.name}</span>
                    </div>

                    {isAssigned && (
                      <Check className="h-3.5 w-3.5 text-accent-blue shrink-0" />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Controls */}
          <div className="mt-2 pt-1.5 border-t border-border-subtle flex items-center justify-between text-[11px]">
            {!isCreatingInline && (
              <button
                type="button"
                onClick={() => {
                  setNewTagName('')
                  setIsCreatingInline(true)
                }}
                className="flex items-center gap-1 text-accent-blue hover:underline"
              >
                <Plus className="h-3 w-3" />
                <span>{tx("New tag")}</span>
              </button>
            )}

            {onOpenManageTags && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenManageTags()
                }}
                className="flex items-center gap-1 text-text-muted hover:text-text-primary ml-auto transition-colors"
                title={tx("Manage all workspace tags")}
              >
                <Settings2 className="h-3 w-3" />
                <span>{tx("Manage")}</span>
              </button>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
