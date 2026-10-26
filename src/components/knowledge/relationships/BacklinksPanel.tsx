import * as React from 'react'
import { Link } from 'react-router-dom'
import type { KnowledgeEntityType, EntityLink } from '@/types'
import { useEntityLinks } from '@/hooks/useKnowledge'
import {
  ArrowDownLeft,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  useResolvedLinks,
  getEntityTypeConfig,
} from './entityResolver'
import { useTranslation } from '@/i18n'

export interface BacklinksPanelProps {
  entityType: KnowledgeEntityType
  entityId: string
  title?: string
  className?: string
  onNavigateToEntity?: (type: KnowledgeEntityType, id: string) => void
}

/**
 * BacklinksPanel — Displays incoming references ("Mentioned in / Linked from X other notes, tasks, or sessions")
 * enabling fast bidirectional navigation across ALTERA entities.
 */
export function BacklinksPanel({
  entityType,
  entityId,
  title = 'Backlinks',
  className,
  onNavigateToEntity,
}: BacklinksPanelProps) {
  const { tx } = useTranslation()
  const { incoming } = useEntityLinks(entityType, entityId)
  const resolvedMap = useResolvedLinks(incoming, 'incoming')

  const renderBacklinkItem = (link: EntityLink) => {
    const entity = resolvedMap[link.id]

    // Loading skeleton
    if (!entity) {
      return (
        <div
          key={link.id}
          className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-xs animate-pulse"
        >
          <div className="h-4 w-4 rounded bg-bg-elevated" />
          <div className="h-3 w-32 rounded bg-bg-elevated" />
        </div>
      )
    }

    // Gracefully handle deleted or missing source entities
    if (entity.isDeleted) {
      return (
        <div
          key={link.id}
          className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-base/60 px-2.5 py-1.5 text-xs opacity-70"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-500/10 text-zinc-400">
              <AlertTriangle className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <span className="font-medium text-text-muted italic truncate block">
                {tx("Entity no longer exists")}</span>
              <span className="text-[10px] text-text-muted block truncate">
                {tx("Source entity was deleted")}</span>
            </div>
          </div>
          <Badge variant="subtle" className="text-[9px] px-1 py-0 h-4 text-text-muted">
            {tx("Missing")}</Badge>
        </div>
      )
    }

    const config = getEntityTypeConfig(entity.type)
    const IconComponent = config.icon

    // Click handler for navigation
    const handleItemClick = (e: React.MouseEvent) => {
      if (onNavigateToEntity) {
        e.preventDefault()
        onNavigateToEntity(entity.type, entity.id)
      }
    }

    return (
      <div
        key={link.id}
        className="group flex items-center justify-between rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-xs hover:border-border hover:bg-bg-elevated/70 transition-colors"
      >
        {entity.routeUrl ? (
          <Link
            to={entity.routeUrl}
            onClick={handleItemClick}
            className="flex items-center gap-2 min-w-0 flex-1 mr-2 text-text-primary hover:text-accent-blue transition-colors"
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs',
                config.badgeColor,
                config.badgeBorder,
                config.badgeText
              )}
              title={tx(config.label)}
            >
              <IconComponent className="h-3 w-3" />
            </span>

            <div className="flex items-center gap-1.5 min-w-0">
              {entity.identifier && (
                <span className="font-mono text-[10px] font-semibold text-accent-blue shrink-0">
                  {entity.identifier}
                </span>
              )}
              <span className="font-medium truncate">{entity.title}</span>
            </div>
          </Link>
        ) : entity.externalUrl ? (
          <a
            href={entity.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 min-w-0 flex-1 mr-2 text-text-primary hover:text-accent-blue transition-colors"
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs',
                config.badgeColor,
                config.badgeBorder,
                config.badgeText
              )}
              title={tx(config.label)}
            >
              <IconComponent className="h-3 w-3" />
            </span>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium truncate">{entity.title}</span>
              <ExternalLink className="h-3 w-3 text-text-muted shrink-0" />
            </div>
          </a>
        ) : (
          <div
            onClick={handleItemClick}
            className={cn(
              'flex items-center gap-2 min-w-0 flex-1 mr-2',
              onNavigateToEntity && 'cursor-pointer hover:text-accent-blue'
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs',
                config.badgeColor,
                config.badgeBorder,
                config.badgeText
              )}
              title={tx(config.label)}
            >
              <IconComponent className="h-3 w-3" />
            </span>

            <div className="flex items-center gap-1.5 min-w-0">
              {entity.identifier && (
                <span className="font-mono text-[10px] font-semibold text-accent-blue shrink-0">
                  {entity.identifier}
                </span>
              )}
              <span className="font-medium truncate">{entity.title}</span>
            </div>
          </div>
        )}

        <Badge
          variant="subtle"
          className={cn('text-[9px] px-1.5 py-0 h-4 font-normal shrink-0', config.badgeText)}
        >
          {tx(config.label)}
        </Badge>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-border bg-bg-surface/50 p-3.5 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-purple/10 text-accent-purple">
            <ArrowDownLeft className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
          <Badge variant="subtle" className="text-[10px] px-1.5 py-0 h-4 font-mono text-text-muted">
            {incoming.length}
          </Badge>
        </div>
      </div>

      {/* Backlinks List */}
      {incoming.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle p-3 text-center">
          <p className="text-[11px] text-text-muted">
            {tx("No incoming references yet. When other notes, tasks, or projects link to this, they'll appear here.")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {incoming.map((link) => renderBacklinkItem(link))}
        </div>
      )}
    </div>
  )
}
