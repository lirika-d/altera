import * as React from 'react'
import type { ResourceType, Resource } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useProjects } from '@/hooks/useProjects'
import { useTags, useKnowledgeActions } from '@/hooks/useKnowledge'
import { cn } from '@/lib/utils'
import {
  Globe,
  Code,
  FileText,
  Star,
  UploadCloud,
  X,
  AlertCircle,
  Plus,
} from 'lucide-react'
import {
  COMMON_LANGUAGES,
  isValidResourceUrl,
  formatFileSize,
} from './urlSecurity'
import { useTranslation } from '@/i18n'

export interface CreateResourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialProjectId?: string
  initialType?: ResourceType
  onSuccess?: (resource: Resource) => void
}

interface CreateResourceFormProps {
  initialProjectId?: string
  initialType?: ResourceType
  onClose: () => void
  onSuccess?: (resource: Resource) => void
}

function CreateResourceForm({
  initialProjectId,
  initialType = 'link',
  onClose,
  onSuccess,
}: CreateResourceFormProps) {
  const { tx } = useTranslation()
  const { createResource, saveAttachment, getOrCreateTag } = useKnowledgeActions()
  const projects = useProjects() || []
  const availableTags = useTags() || []

  // Form State initialized directly from props
  const [type, setType] = React.useState<ResourceType>(initialType)
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [snippetContent, setSnippetContent] = React.useState('')
  const [language, setLanguage] = React.useState('typescript')
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [projectId, setProjectId] = React.useState<string>(initialProjectId || 'none')
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([])
  const [newTagInput, setNewTagInput] = React.useState('')
  const [isFavorite, setIsFavorite] = React.useState(false)

  // UI State
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [urlTouched, setUrlTouched] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // URL security check
  const isUrlValid = type === 'link' ? isValidResourceUrl(url) : true

  // Handle Tag toggle
  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  // Handle adding custom tag
  const handleAddCustomTag = async (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return
    e.preventDefault()
    const trimmed = newTagInput.trim().replace(/^#/, '')
    if (!trimmed) return

    try {
      const tag = await getOrCreateTag(trimmed)
      if (!selectedTagIds.includes(tag.id)) {
        setSelectedTagIds((prev) => [...prev, tag.id])
      }
      setNewTagInput('')
    } catch {
      console.error('Tag creation from resource form failed')
    }
  }

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!title) {
        setTitle(file.name)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!title.trim()) {
      setErrorMessage(tx('Please enter a title for the resource.'))
      return
    }

    if (type === 'link') {
      if (!url.trim()) {
        setErrorMessage(tx('Please provide a URL.'))
        return
      }
      if (!isValidResourceUrl(url)) {
        setErrorMessage(
          tx('Security Error: URL must use http: or https: protocol. Unsafe schemes (javascript:, data:, vbscript:) are rejected.')
        )
        return
      }
    }

    if (type === 'snippet' && !snippetContent.trim()) {
      setErrorMessage(tx('Please enter snippet code content.'))
      return
    }

    if (type === 'file' && !selectedFile) {
      setErrorMessage(tx('Please select a file to attach.'))
      return
    }

    setIsSubmitting(true)
    try {
      let attachmentId: string | undefined = undefined

      if (type === 'file' && selectedFile) {
        const attachment = await saveAttachment(selectedFile)
        attachmentId = attachment.id
      }

      const created = await createResource({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        url: type === 'link' ? url.trim() : undefined,
        snippetContent: type === 'snippet' ? snippetContent : undefined,
        language: type === 'snippet' ? language : undefined,
        attachmentId,
        isFavorite,
        projectId: projectId === 'none' ? undefined : projectId,
        tagIds: selectedTagIds,
      })

      onClose()
      onSuccess?.(created)
    } catch {
      console.error('Resource creation failed')
      setErrorMessage(tx('Failed to create resource'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>{tx("New Knowledge Resource")}</DialogTitle>
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors border',
                isFavorite
                  ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
                  : 'border-border text-text-muted hover:text-text-primary'
              )}
              title={tx("Favorite resource")}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5',
                  isFavorite ? 'fill-accent-amber text-accent-amber' : ''
                )}
              />
              <span>{isFavorite ? tx('Favorited') : tx('Favorite')}</span>
            </button>
          </div>
          <DialogDescription>
            {tx("Save external links, code snippets, or reference files for instant access.")}</DialogDescription>
        </DialogHeader>

        {/* Type Selector Pill Segmented Control */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-text-secondary">
            {tx("Resource Type")}</label>
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-bg-base p-1">
            <button
              type="button"
              onClick={() => setType('link')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all select-none',
                type === 'link'
                  ? 'bg-bg-elevated text-accent-blue shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{tx("Web Link")}</span>
            </button>
            <button
              type="button"
              onClick={() => setType('snippet')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all select-none',
                type === 'snippet'
                  ? 'bg-bg-elevated text-accent-purple shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <Code className="h-3.5 w-3.5" />
              <span>{tx("Code Snippet")}</span>
            </button>
            <button
              type="button"
              onClick={() => setType('file')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all select-none',
                type === 'file'
                  ? 'bg-bg-elevated text-accent-amber shadow-sm border border-border/80'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{tx("Reference File")}</span>
            </button>
          </div>
        </div>

        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-text-secondary">
            {tx("Title")}<span className="text-accent-red">*</span>
          </label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === 'link'
                ? 'e.g. Tailwind CSS Documentation'
                : type === 'snippet'
                ? 'e.g. Supabase Client Setup'
                : 'e.g. Architecture Overview PDF'
            }
            required
          />
        </div>

        {/* TYPE-SPECIFIC INPUTS */}

        {/* 1. Link: URL Input with Strict Validation */}
        {type === 'link' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary flex items-center justify-between">
              <span>{tx("URL")}<span className="text-accent-red">*</span></span>
              <span className="text-[10px] text-text-muted">{tx('http:// or https:// only')}</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-2.5 top-2 h-4 w-4 text-text-muted" />
              <Input
                className={cn(
                  'pl-8 font-mono text-xs',
                  urlTouched && !isUrlValid && url && 'border-accent-red focus-visible:ring-accent-red/30'
                )}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setUrlTouched(true)
                }}
                onBlur={() => setUrlTouched(true)}
                placeholder="https://example.com/docs"
                required
              />
            </div>
            {urlTouched && url && !isUrlValid && (
              <div className="flex items-center gap-1 text-[11px] text-accent-red">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{tx("Must be a valid URL starting with http:// or https://")}</span>
              </div>
            )}
          </div>
        )}

        {/* 2. Snippet: Language dropdown & code textarea */}
        {type === 'snippet' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-text-secondary">
                {tx("Language")}</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tx("Select language")} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {COMMON_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {tx(lang.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-text-secondary">
                <span>{tx("Snippet Code")}<span className="text-accent-red">*</span></span>
                <span className="text-[10px] text-text-muted font-mono">
                  {snippetContent.split('\n').length} {tx("lines")}</span>
              </div>
              <Textarea
                value={snippetContent}
                onChange={(e) => setSnippetContent(e.target.value)}
                placeholder={tx('// Paste or write your code snippet here...')}
                className="font-mono text-xs min-h-[140px] leading-relaxed bg-bg-base resize-y"
                required
              />
            </div>
          </div>
        )}

        {/* 3. File: Attachment Input */}
        {type === 'file' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary">
              {tx("Attachment File")}<span className="text-accent-red">*</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />

            {selectedFile ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-bg-base p-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-accent-amber" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[10px] text-text-muted font-mono">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || 'file'}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-text-muted hover:text-accent-red"
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                className="flex flex-col items-center justify-center rounded-md border border-dashed border-border-subtle bg-bg-base/50 p-6 hover:bg-bg-base/80 hover:border-accent-blue/40 cursor-pointer transition-colors"
              >
                <UploadCloud className="h-7 w-7 text-text-muted mb-2" />
                <span className="text-xs font-medium text-text-primary mb-0.5">
                  {tx("Click to select file")}</span>
                <span className="text-[10px] text-text-muted">
                  {tx("Supports documents, archives, images, PDFs, etc.")}</span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-text-secondary">
              {tx("Description")} <span className="text-text-muted font-normal">{tx("(optional)")}</span>
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tx("Add context, notes, or usage instructions...")}
            className="min-h-[64px]"
          />
        </div>

        {/* Project Picker */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-text-secondary">
              {tx("Project")} <span className="text-text-muted font-normal">{tx("(optional)")}</span>
          </label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder={tx("Select a project")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="text-text-muted">{tx("None (Global Resource)")}</span>
              </SelectItem>
              {projects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  <span className="mr-1.5">{proj.icon || '📁'}</span>
                  <span className="font-mono text-accent-blue/90 mr-1.5">
                    {proj.identifier}
                  </span>
                  <span>{proj.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags Selector & Quick Creation */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-text-secondary">
              {tx("Tags")} <span className="text-text-muted font-normal">{tx("(optional)")}</span>
          </label>

          {/* Existing tags pills */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 max-h-24 overflow-y-auto p-1 rounded border border-border-subtle bg-bg-base/40">
              {availableTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors select-none',
                      isSelected
                        ? 'border-accent-blue/30 bg-accent-blue/15 text-accent-blue font-semibold'
                        : 'border-border-subtle bg-bg-surface text-text-muted hover:text-text-secondary hover:border-border'
                    )}
                  >
                    #{tag.name}
                  </button>
                )
              })}
            </div>
          )}

          {/* Custom Tag Input */}
          <div className="flex items-center gap-1.5">
            <Input
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleAddCustomTag}
              placeholder={tx("Type tag name and press Enter...")}
              className="text-xs h-7"
            />
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={handleAddCustomTag}
              disabled={!newTagInput.trim()}
              className="h-7 shrink-0"
            >
              <Plus className="h-3 w-3 mr-1" />
              {tx("Add")}</Button>
          </div>

          {selectedTagIds.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-1">
              <span className="text-[10px] text-text-muted">{tx("Selected:")}</span>
              {selectedTagIds.map((id) => {
                const tag = availableTags.find((t) => t.id === id)
                if (!tag) return null
                return (
                  <Badge
                    key={id}
                    variant="default"
                    className="text-[10px] gap-1 cursor-pointer"
                    onClick={() => toggleTag(id)}
                  >
                    #{tag.name}
                    <X className="h-2.5 w-2.5 opacity-70 hover:opacity-100" />
                  </Badge>
                )
              })}
            </div>
          )}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-2.5 text-xs text-accent-red flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {tx("Cancel")}</Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || (type === 'link' && (!isUrlValid || !url))}
          >
            {isSubmitting ? tx("Saving...") : tx("Create Resource")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export function CreateResourceDialog({
  open,
  onOpenChange,
  initialProjectId,
  initialType = 'link',
  onSuccess,
}: CreateResourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CreateResourceForm
          key={`${initialType}-${initialProjectId || 'none'}`}
          initialProjectId={initialProjectId}
          initialType={initialType}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  )
}
