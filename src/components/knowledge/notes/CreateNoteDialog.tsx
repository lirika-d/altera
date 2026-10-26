import * as React from 'react'
import type { Note } from '@/types'
import { Plus, Star, FolderGit2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjects } from '@/hooks/useProjects'
import { useKnowledgeActions } from '@/hooks/useKnowledge'
import { createEmptyDoc } from '@/components/knowledge/editor'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

export interface CreateNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProjectId?: string
  onCreated?: (note: Note) => void
}

export function CreateNoteDialog({
  open,
  onOpenChange,
  initialProjectId,
  onCreated,
}: CreateNoteDialogProps) {
  const { tx } = useTranslation()
  const { createNote } = useKnowledgeActions()
  const projects = useProjects() || []

  const [title, setTitle] = React.useState('')
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(
    initialProjectId || 'none'
  )
  const [isFavorite, setIsFavorite] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset state when dialog opens or closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setTitle('')
      setSelectedProjectId(initialProjectId || 'none')
      setIsFavorite(false)
      setError(null)
      setIsSubmitting(false)
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError(tx('Note title is required'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const initialDoc = createEmptyDoc()
      const newNote = await createNote({
        title: trimmedTitle,
        contentJSON: JSON.stringify(initialDoc),
        plainText: '',
        projectId: selectedProjectId !== 'none' ? selectedProjectId : undefined,
        isFavorite,
      })

      onOpenChange(false)
      onCreated?.(newNote)
    } catch {
      console.error('Note creation failed')
      setError(tx('Failed to create note'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 text-text-primary">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-blue/15 text-accent-blue border border-accent-blue/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <DialogTitle>{tx("New Note")}</DialogTitle>
            </div>
            <DialogDescription>
              {tx("Create a document to write project specifications, meeting notes, or ideas.")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
                {error}
              </div>
            )}

            {/* Note Title Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="note-title-input"
                className="text-xs font-medium text-text-secondary"
              >
                {tx("Title")}<span className="text-accent-red">*</span>
              </label>
              <Input
                id="note-title-input"
                autoFocus
                placeholder={tx("e.g. Architecture RFC, Sprint Planning...")}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isSubmitting}
                className="bg-bg-elevated border-border"
              />
            </div>

            {/* Project Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary flex items-center justify-between">
                <span>{tx("Associated Project")}</span>
                <span className="text-[11px] text-text-muted font-normal">{tx("Optional")}</span>
              </label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={isSubmitting}
              >
                <SelectTrigger className="bg-bg-elevated border-border">
                  <SelectValue placeholder={tx("Select project...")} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="none">
                    <span className="text-text-muted">{tx("No Project (Global note)")}</span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.icon ? <span>{p.icon}</span> : <FolderGit2 className="h-3.5 w-3.5 text-text-muted" />}
                        <span className="font-mono text-[11px] text-text-secondary">
                          {p.identifier}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Favorite Pin Toggle */}
            <div className="pt-1">
              <label
                onClick={() => setIsFavorite(!isFavorite)}
                className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-text-secondary hover:text-text-primary"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                    isFavorite
                      ? 'bg-accent-amber border-accent-amber text-black'
                      : 'border-border bg-bg-elevated text-transparent'
                  )}
                >
                  <Star className="h-3 w-3 fill-current" />
                </button>
                <span>{tx("Pin note to favorites")}</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {tx("Cancel")}</Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !title.trim()}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {isSubmitting ? tx("Creating...") : tx("Create Note")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
