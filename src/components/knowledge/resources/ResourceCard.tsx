import * as React from 'react'
import type { Resource } from '@/types'
import {
  Globe,
  Code,
  FileText,
  Star,
  Copy,
  Check,
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
  RotateCcw,
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

export interface ResourceCardProps {
  resource: Resource
  onSelect?: (resource: Resource) => void
  onEdit?: (resource: Resource) => void
  onDelete?: (resource: Resource) => void
  className?: string
  showProject?: boolean
}

export function ResourceCard({
  resource,
  onSelect,
  onEdit,
  onDelete,
  className,
  showProject = true,
}: ResourceCardProps) {
  const { tx } = useTranslation()
  const { toggleResourceFavorite, softDeleteResource, restoreResource } =
    useKnowledgeActions()
  const [copied, setCopied] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  // Associated project
  const project = useProject(resource.projectId)

  // Associated tags
  const tags = useEntityTags('resource', resource.id)

  // Associated attachment (for 'file' type)
  const attachment = useAttachment(resource.attachmentId)

  const isTrash = !!resource.deletedAt
  const domain = getDomainFromUrl(resource.url)
  const hasValidUrl = isValidResourceUrl(resource.url)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
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
        setTimeout(() => setCopied(false), 1800)
      }
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await toggleResourceFavorite(resource.id)
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

  const handleSoftDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (onDelete) {
        onDelete(resource)
      } else {
        await softDeleteResource(resource.id)
      }
    } catch (err) {
      console.error('Failed to soft-delete resource:', err)
    }
  }

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await restoreResource(resource.id)
    } catch (err) {
      console.error('Failed to restore resource:', err)
    }
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(resource)
  }

  const handleCardClick = () => {
    onSelect?.(resource)
  }

  // Type-specific icon & styling
  const typeConfig = {
    link: {
      icon: Globe,
      color: 'text-accent-blue',
      bgColor: 'bg-accent-blue/10',
      borderColor: 'border-accent-blue/20',
      label: 'Link',
    },
    snippet: {
      icon: Code,
      color: 'text-accent-purple',
      bgColor: 'bg-accent-purple/10',
      borderColor: 'border-accent-purple/20',
      label: 'Snippet',
    },
    file: {
      icon: FileText,
      color: 'text-accent-amber',
      bgColor: 'bg-accent-amber/10',
      borderColor: 'border-accent-amber/20',
      label: 'File',
    },
  }[resource.type]

  const TypeIcon = typeConfig.icon

  // Calculate snippet stats
  const snippetLines = resource.snippetContent
    ? resource.snippetContent.split('\n').length
    : 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group relative flex flex-col justify-between rounded-lg border border-border bg-bg-surface p-3 text-left transition-all duration-150',
        'hover:border-border/80 hover:bg-bg-elevated hover:shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-blue/50',
        isTrash && 'opacity-70 border-dashed border-border-subtle bg-bg-base/60',
        className
      )}
    >
      {/* Top Header Row: Type Icon, Title, and Actions */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs',
                typeConfig.bgColor,
                typeConfig.borderColor,
                typeConfig.color
              )}
              title={tx(typeConfig.label)}
            >
              <TypeIcon className="h-3.5 w-3.5" />
            </span>
            <h4 className="text-xs font-semibold text-text-primary truncate leading-snug group-hover:text-text-primary">
              {resource.title || tx('Untitled Resource')}
            </h4>
          </div>

          {/* Top Actions: Star & Menu */}
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {!isTrash && (
              <button
                type="button"
                onClick={handleToggleFavorite}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded transition-colors',
                  resource.isFavorite
                    ? 'text-accent-amber hover:text-accent-amber/80'
                    : 'text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100'
                )}
                title={resource.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star
                  className={cn(
                    'h-3.5 w-3.5',
                    resource.isFavorite ? 'fill-accent-amber text-accent-amber' : ''
                  )}
                />
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-opacity',
                    isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                  title={tx("More actions")}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleCopy}>
                  {copied ? (
                    <Check className="mr-2 h-3.5 w-3.5 text-accent-green" />
                  ) : (
                    <Copy className="mr-2 h-3.5 w-3.5 text-text-secondary" />
                  )}
                  <span>{copied ? tx("Copied!") : tx("Copy")}</span>
                </DropdownMenuItem>

                {!isTrash && onEdit && (
                  <DropdownMenuItem onClick={handleEditClick}>
                    <Pencil className="mr-2 h-3.5 w-3.5 text-text-secondary" />
                    <span>{tx("Edit")}</span>
                  </DropdownMenuItem>
                )}

                {resource.type === 'link' && hasValidUrl && (
                  <DropdownMenuItem asChild>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center w-full"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5 text-text-secondary" />
                      <span>{tx("Open Link")}</span>
                    </a>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {isTrash ? (
                  <DropdownMenuItem onClick={handleRestore} className="text-accent-blue">
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    <span>{tx("Restore")}</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleSoftDelete} className="text-accent-red">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    <span>{tx("Delete")}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Description or Content Preview */}
        {resource.description && (
          <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed mb-2">
            {resource.description}
          </p>
        )}

        {/* Type-Specific Content Previews */}
        {resource.type === 'link' && resource.url && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 overflow-hidden rounded border border-border-subtle bg-bg-base/70 px-2 py-1 text-[11px] font-mono text-text-secondary">
              <Globe className="h-3 w-3 shrink-0 text-accent-blue opacity-70" />
              <span className="truncate">{domain || resource.url}</span>
              {hasValidUrl && (
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto inline-flex items-center text-text-muted hover:text-accent-blue transition-colors shrink-0"
                  title={tx("Open external link safely")}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {resource.type === 'snippet' && resource.snippetContent && (
          <div className="mb-2">
            <div className="relative rounded border border-border-subtle bg-bg-base/80 p-2 font-mono text-[11px] text-text-secondary leading-snug">
              <div className="flex items-center justify-between text-[10px] text-text-muted mb-1 pb-1 border-b border-border-subtle/50">
                <span className="uppercase font-semibold tracking-wider text-accent-purple/90">
                  {resource.language || 'Code'}
                </span>
                <span>
                  {snippetLines} {snippetLines === 1 ? tx("line") : snippetLines < 5 ? tx("linesFew") : tx("lines")}
                </span>
              </div>
              <pre className="max-h-16 overflow-hidden text-ellipsis whitespace-pre-wrap line-clamp-2 opacity-90 select-none font-mono">
                {resource.snippetContent}
              </pre>
            </div>
          </div>
        )}

        {resource.type === 'file' && (
          <div className="mb-2">
            <div className="flex items-center justify-between rounded border border-border-subtle bg-bg-base/70 px-2.5 py-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="h-3.5 w-3.5 shrink-0 text-accent-amber" />
                <span className="truncate font-medium text-text-secondary">
                  {attachment?.filename || resource.title}
                </span>
              </div>
              {attachment?.size !== undefined && (
                <span className="text-[10px] text-text-muted font-mono shrink-0 ml-2">
                  {formatFileSize(attachment.size)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer: Metadata (Project, Tags, Copied Indicator) */}
      <div className="mt-1 pt-1.5 border-t border-border-subtle/40 flex items-center justify-between gap-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 overflow-hidden flex-wrap">
          {showProject && project && (
            <span
              className="inline-flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-secondary border border-border-subtle"
              title={`Project: ${project.name}`}
            >
              <span>{project.icon || '📁'}</span>
              <span className="font-mono text-accent-blue/90">{project.identifier}</span>
            </span>
          )}

          {tags.slice(0, 2).map((t) => (
            <Badge key={t.id} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
              #{t.name}
            </Badge>
          ))}

          {tags.length > 2 && (
            <span className="text-[10px] text-text-muted font-mono">
              +{tags.length - 2}
            </span>
          )}

          {isTrash && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
              {tx("Trash")}</Badge>
          )}
        </div>

        {/* Quick action: Copy Button */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className={cn(
              'h-5 px-1.5 text-[10px] text-text-muted hover:text-text-primary transition-colors',
              copied && 'text-accent-green hover:text-accent-green'
            )}
            title={tx("Quick copy")}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-0.5 text-accent-green" />
                <span>{tx("Copied")}</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-0.5 opacity-70" />
                <span>{tx("Copy")}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
