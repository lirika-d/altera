import * as React from 'react'
import { Link } from 'react-router-dom'
import type { KnowledgeEntityType, EntityLink } from '@/types'
import { useEntityLinks, useKnowledgeActions } from '@/hooks/useKnowledge'
import {
  Link2,
  Unlink,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  useResolvedLinks,
  getEntityTypeConfig,
} from './entityResolver'
import { EntityLinker } from './EntityLinker'
import { useTranslation } from '@/i18n'

export interface LinkedEntitiesProps {
  entityType: KnowledgeEntityType
  entityId: string
  title?: string
  showAddButton?: boolean
  allowUnlink?: boolean
  groupByType?: boolean
  className?: string
  onNavigateToEntity?: (type: KnowledgeEntityType, id: string) => void
}

/**
 * LinkedEntities — Compact panel showing all outgoing links with icons,
 * identifiers, titles, clickable navigation, graceful deleted item handling,
 * and unlink confirmation.
 */
export function LinkedEntities({
  entityType,
  entityId,
  title = 'Linked Entities',
  showAddButton = true,
  allowUnlink = true,
  groupByType = false,
  className,
  onNavigateToEntity,
}: LinkedEntitiesProps) {
  const { tx } = useTranslation()
  const { outgoing } = useEntityLinks(entityType, entityId)
  const resolvedMap = useResolvedLinks(outgoing, 'outgoing')
  const { deleteEntityLink } = useKnowledgeActions()

  // Unlink confirmation state
  const [unlinkingLinkId, setUnlinkingLinkId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleConfirmUnlink = async (linkId: string) => {
    setIsDeleting(true)
    try {
      await deleteEntityLink(linkId)
      setUnlinkingLinkId(null)
    } catch (err) {
      console.error('Failed to unlink entity:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Render a single linked entity row
  const renderItem = (link: EntityLink) => {
    const entity = resolvedMap[link.id]
    const isUnlinking = unlinkingLinkId === link.id

    // Fallback if entity is still resolving
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

    // Confirmation state for unlinking
    if (isUnlinking) {
      return (
        <div
          key={link.id}
          className="flex items-center justify-between rounded-lg border border-accent-red/30 bg-accent-red/10 px-2.5 py-1.5 text-xs"
        >
          <div className="flex items-center gap-1.5 text-accent-red truncate mr-2">
            <Unlink className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {tx("Unlink")} <strong>{entity.title}</strong>?
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="xs"
              variant="danger"
              disabled={isDeleting}
              onClick={() => handleConfirmUnlink(link.id)}
              className="h-5 px-1.5 text-[10px]"
            >
              {isDeleting ? tx("Removing...") : tx("Unlink")}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setUnlinkingLinkId(null)}
              className="h-5 px-1.5 text-[10px]"
            >
              {tx("Cancel")}</Button>
          </div>
        </div>
      )
    }

    // Gracefully handle deleted or missing entities
    if (entity.isDeleted) {
      return (
        <div
          key={link.id}
          className="group flex items-center justify-between rounded-lg border border-border-subtle bg-bg-base/60 px-2.5 py-1.5 text-xs opacity-70"
        >
          <div className="flex items-center gap-2 min-w-0 mr-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-500/10 text-zinc-400">
              <AlertTriangle className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <span className="font-medium text-text-muted italic truncate block">
                {tx("Entity no longer exists")}</span>
              <span className="text-[10px] text-text-muted block truncate">
                {tx('Target reference was removed')}
              </span>
            </div>
          </div>

          {allowUnlink && (
            <button
              type="button"
              onClick={() => setUnlinkingLinkId(link.id)}
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
              title={tx("Remove broken link")}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )
    }

    const config = getEntityTypeConfig(entity.type)
    const IconComponent = config.icon

    // Click handler for custom navigation or link
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
        {/* Clickable Entity Body */}
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

        {/* Right Actions: Type Badge & Unlink */}
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            variant="subtle"
            className={cn('text-[9px] px-1.5 py-0 h-4 font-normal', config.badgeText)}
          >
            {tx(config.label)}
          </Badge>

          {allowUnlink && (
            <button
              type="button"
              onClick={() => setUnlinkingLinkId(link.id)}
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
              title={tx("Unlink")}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // If grouped by type
  const groupedLinks = React.useMemo(() => {
    if (!groupByType) return null
    const groups: Record<KnowledgeEntityType, EntityLink[]> = {
      project: [],
      task: [],
      session: [],
      note: [],
      resource: [],
    }
    for (const l of outgoing) {
      if (groups[l.targetType]) {
        groups[l.targetType].push(l)
      }
    }
    return groups
  }, [outgoing, groupByType])

  return (
    <div className={cn('rounded-xl border border-border bg-bg-surface/50 p-3.5 space-y-3', className)}>
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-blue/10 text-accent-blue">
            <Link2 className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
          <Badge variant="subtle" className="text-[10px] px-1.5 py-0 h-4 font-mono text-text-muted">
            {outgoing.length}
          </Badge>
        </div>

        {/* Add Link Trigger */}
        {showAddButton && (
          <EntityLinker
            sourceType={entityType}
            sourceId={entityId}
          />
        )}
      </div>

      {/* Outgoing Links List */}
      {outgoing.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle p-3 text-center">
          <p className="text-[11px] text-text-muted">{tx("No linked entities yet.")}</p>
        </div>
      ) : groupByType && groupedLinks ? (
        <div className="space-y-3">
          {(['project', 'task', 'session', 'note', 'resource'] as const).map((type) => {
            const list = groupedLinks[type]
            if (list.length === 0) return null
            const config = getEntityTypeConfig(type)

            return (
              <div key={type} className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {tx(config.pluralLabel)} ({list.length})
                </span>
                <div className="space-y-1">
                  {list.map((link) => renderItem(link))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {outgoing.map((link) => renderItem(link))}
        </div>
      )}
    </div>
  )
}
