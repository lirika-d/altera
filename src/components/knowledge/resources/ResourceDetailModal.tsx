import * as React from 'react'
import type { Resource } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Globe,
  Code,
  FileText,
  Star,
  Copy,
  Check,
  ExternalLink,
  Download,
  Pencil,
  Trash2,
  RotateCcw,
  Calendar,
  Clock,
  FolderGit2,
} from 'lucide-react'
import { useAttachment, useEntityTags, useKnowledgeActions } from '@/hooks/useKnowledge'
import { useProject } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import {
  getDomainFromUrl,
  isValidResourceUrl,
  copyToClipboard,
  formatFileSize,
} from './urlSecurity'
import { useTranslation } from '@/i18n'

export interface ResourceDetailModalProps {
  resource: Resource | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (resource: Resource) => void
  onDelete?: (resource: Resource) => void
}

export function ResourceDetailModal({
  resource,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ResourceDetailModalProps) {
  const { tx, i18n } = useTranslation()
  const { toggleResourceFavorite, softDeleteResource, restoreResource } =
    useKnowledgeActions()
  const [copied, setCopied] = React.useState(false)

  // Fetch linked entities
  const project = useProject(resource?.projectId)
  const tags = useEntityTags('resource', resource?.id)
  const attachment = useAttachment(resource?.attachmentId)

  if (!resource) return null

  const isTrash = !!resource.deletedAt
  const domain = getDomainFromUrl(resource.url)
  const hasValidUrl = isValidResourceUrl(resource.url)

  const handleCopy = async () => {
    let textToCopy = ''
    if (resource.type === 'snippet' && resource.snippetContent) {
      textToCopy = resource.snippetContent
    } else if (resource.type === 'link' && resource.url) {
      textToCopy = resource.url
    } else if (resource.type === 'file') {
      textToCopy = attachment?.filename || resource.title
    }

    if (textToCopy) {
      const ok = await copyToClipboard(textToCopy)
      if (ok) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const handleToggleFavorite = async () => {
    try {
      await toggleResourceFavorite(resource.id)
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

  const handleSoftDelete = async () => {
    try {
      if (onDelete) {
        onDelete(resource)
      } else {
        await softDeleteResource(resource.id)
      }
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to delete resource:', err)
    }
  }

  const handleRestore = async () => {
    try {
      await restoreResource(resource.id)
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to restore resource:', err)
    }
  }

  const handleDownloadAttachment = () => {
    if (!attachment?.blob) return
    const objectUrl = URL.createObjectURL(attachment.blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = attachment.filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  // Type-specific icon & styling
  const typeConfig = {
    link: {
      icon: Globe,
      color: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
      borderColor: 'border-accent-blue/20',
      label: 'Web Link',
    },
    snippet: {
      icon: Code,
      color: 'text-accent-purple',
      bgColor: 'bg-accent-purple/10',
      borderColor: 'border-accent-purple/20',
      label: 'Code Snippet',
    },
    file: {
      icon: FileText,
      color: 'text-accent-amber',
      bgColor: 'bg-accent-amber/10',
      borderColor: 'border-accent-amber/20',
      label: 'Reference File',
    },
  }[resource.type]

  const TypeIcon = typeConfig.icon

  // Format dates
  const formatDate = (date: Date | string) => {
    try {
      const d = new Date(date)
      return d.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return String(date)
    }
  }

  const snippetLines = resource.snippetContent
    ? resource.snippetContent.split('\n')
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-start gap-2.5 min-w-0">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm mt-0.5',
                  typeConfig.bgColor,
                  typeConfig.borderColor,
                  typeConfig.color
                )}
              >
                <TypeIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                    {tx(typeConfig.label)}
                  </Badge>
                  {isTrash && (
                    <Badge variant="destructive" className="text-[10px]">
                      {tx("In Trash")}</Badge>
                  )}
                  {resource.isFavorite && (
                    <Badge variant="warning" className="text-[10px] gap-1">
                      <Star className="h-2.5 w-2.5 fill-accent-amber" />
                      {tx("Favorite")}</Badge>
                  )}
                </div>
                <DialogTitle className="text-base font-semibold text-text-primary leading-snug break-words">
                  {resource.title}
                </DialogTitle>
              </div>
            </div>

            {/* Quick action buttons in header */}
            <div className="flex items-center gap-1 shrink-0">
              {!isTrash && (
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded border transition-colors',
                    resource.isFavorite
                      ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
                      : 'border-border text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  )}
                  title={resource.isFavorite ? 'Remove favorite' : 'Add favorite'}
                >
                  <Star
                    className={cn(
                      'h-3.5 w-3.5',
                      resource.isFavorite ? 'fill-accent-amber text-accent-amber' : ''
                    )}
                  />
                </button>
              )}

              {!isTrash && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false)
                    onEdit(resource)
                  }}
                  className="h-7 px-2 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {tx("Edit")}</Button>
              )}
            </div>
          </div>

          <DialogDescription className="sr-only">
            {tx("Resource details for")} {resource.title}
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        <div className="space-y-4 py-2">
          {/* Description */}
          {resource.description && (
            <div className="rounded-md border border-border-subtle bg-bg-base/40 p-3">
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                {resource.description}
              </p>
            </div>
          )}

          {/* 1. TYPE LINK: Domain & Safe External Link Box */}
          {resource.type === 'link' && resource.url && (
            <div className="rounded-lg border border-border bg-bg-base p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-accent-blue/15 text-accent-blue">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {domain || 'External Website'}
                    </p>
                    <p className="text-[11px] font-mono text-text-muted truncate">
                      {resource.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleCopy}
                    className="h-7 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-accent-green" />
                        {tx("Copied")}</>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        {tx("Copy URL")}</>
                    )}
                  </Button>

                  {hasValidUrl && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-accent-blue text-white hover:bg-accent-blue/90 shadow-sm h-6 px-2.5 text-xs gap-1"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {tx("Visit Link")}</a>
                  )}
                </div>
              </div>

              {!hasValidUrl && (
                <p className="text-[11px] text-accent-red font-medium">
                  {tx("Warning: This URL does not use a recognized safe protocol (http/https). Direct navigation is restricted.")}</p>
              )}
            </div>
          )}

          {/* 2. TYPE SNIPPET: Code Display with Line Numbers & Copy */}
          {resource.type === 'snippet' && resource.snippetContent && (
            <div className="rounded-lg border border-border bg-bg-base overflow-hidden">
              {/* Snippet Header */}
              <div className="flex items-center justify-between border-b border-border bg-bg-elevated/80 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Code className="h-3.5 w-3.5 text-accent-purple" />
                  <span className="font-mono text-[11px] font-semibold uppercase text-accent-purple">
                    {resource.language || 'Code'}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    ({snippetLines.length} {snippetLines.length === 1 ? tx("line") : snippetLines.length < 5 ? tx("linesFew") : tx("lines")})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleCopy}
                  className={cn(
                    'h-6 px-2 text-[11px] transition-colors',
                    copied && 'text-accent-green'
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-accent-green" />
                      {tx("Copied Code")}</>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      {tx("Copy Code")}</>
                  )}
                </Button>
              </div>

              {/* Code block with line numbers */}
              <div className="p-3 font-mono text-xs overflow-x-auto leading-relaxed max-h-96">
                <table className="w-full border-collapse">
                  <tbody>
                    {snippetLines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-bg-hover/50">
                        <td className="w-8 pr-3 select-none text-right text-[10px] text-text-muted/60 font-mono align-top">
                          {idx + 1}
                        </td>
                        <td className="whitespace-pre text-text-primary font-mono align-top">
                          {line || '\n'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. TYPE FILE: Attachment info & Download */}
          {resource.type === 'file' && (
            <div className="rounded-lg border border-border bg-bg-base p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-amber/15 text-accent-amber border border-accent-amber/20">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {attachment?.filename || resource.title}
                    </p>
                    <p className="text-[11px] text-text-muted font-mono">
                      {attachment?.size !== undefined
                        ? formatFileSize(attachment.size)
                        : tx("Unknown size")}{' '}
                      • {attachment?.mimeType || 'Application file'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {attachment?.blob && (
                    <Button
                      size="sm"
                      onClick={handleDownloadAttachment}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {tx("Download")}</Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Project & Tag Association Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Project */}
            <div className="rounded-md border border-border-subtle bg-bg-base/50 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
                <FolderGit2 className="h-3 w-3" /> {tx("Project")}</span>
              {project ? (
                <div className="flex items-center gap-2 mt-1">
                  <span>{project.icon || '📁'}</span>
                  <span className="font-mono text-xs text-accent-blue font-medium">
                    {project.identifier}
                  </span>
                  <span className="text-xs text-text-primary truncate">
                    {project.name}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-text-muted mt-1 italic">
                  {tx("No linked project (Global)")}</p>
              )}
            </div>

            {/* Tags */}
            <div className="rounded-md border border-border-subtle bg-bg-base/50 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1 block">
                {tx("Tags")}</span>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tags.map((t) => (
                    <Badge key={t.id} variant="secondary" className="text-[10px]">
                      #{t.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted mt-1 italic">{tx("No tags assigned")}</p>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex items-center justify-between text-[11px] text-text-muted pt-2 border-t border-border-subtle">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {tx("Created:")} {formatDate(resource.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {tx("Updated:")} {formatDate(resource.updatedAt)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex items-center justify-between w-full pt-3 border-t border-border">
          <div>
            {isTrash ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                className="text-accent-blue border-accent-blue/30 hover:bg-accent-blue/10"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                {tx("Restore Resource")}</Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={handleSoftDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {tx("Move to Trash")}</Button>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {tx("Close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ResourceDetailModal as ResourceDetailDialog }
export type { ResourceDetailModalProps as ResourceDetailDialogProps }
