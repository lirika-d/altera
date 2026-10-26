/**
 * entityResolver.ts — Bidirectional entity metadata resolver and utilities
 * for projects, tasks, sessions, notes, and resources.
 */

import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { sanitizeResourceUrl } from '@/lib/resourceUrl'
import type {
  KnowledgeEntityType,
  EntityLink,
  Project,
  Task,
  Session,
  Note,
  Resource,
} from '@/types'
import {
  Folder,
  CheckSquare,
  Timer,
  FileText,
  Link2,
  AlertTriangle,
} from 'lucide-react'

export interface ResolvedEntity {
  id: string
  type: KnowledgeEntityType
  title: string
  identifier?: string // e.g. 'ALT-001'
  subtitle?: string
  icon?: string // emoji or icon
  routeUrl?: string
  externalUrl?: string
  isDeleted: boolean
  status?: string
  priority?: string
  raw?: Project | Task | Session | Note | Resource
}

export interface EntityTypeConfig {
  type: KnowledgeEntityType
  label: string
  pluralLabel: string
  icon: React.ComponentType<{ className?: string }>
  badgeColor: string
  badgeBorder: string
  badgeText: string
}

const EMPTY_RESOLVED_LINKS = Object.create(null) as Record<string, ResolvedEntity>

/**
 * Returns UI metadata (icon, label, badge styling) for each entity type.
 */
export function getEntityTypeConfig(type: KnowledgeEntityType): EntityTypeConfig {
  switch (type) {
    case 'project':
      return {
        type: 'project',
        label: 'Project',
        pluralLabel: 'Projects',
        icon: Folder,
        badgeColor: 'bg-accent-blue/10',
        badgeBorder: 'border-accent-blue/20',
        badgeText: 'text-accent-blue',
      }
    case 'task':
      return {
        type: 'task',
        label: 'Task',
        pluralLabel: 'Tasks',
        icon: CheckSquare,
        badgeColor: 'bg-accent-green/10',
        badgeBorder: 'border-accent-green/20',
        badgeText: 'text-accent-green',
      }
    case 'session':
      return {
        type: 'session',
        label: 'Session',
        pluralLabel: 'Sessions',
        icon: Timer,
        badgeColor: 'bg-accent-amber/10',
        badgeBorder: 'border-accent-amber/20',
        badgeText: 'text-accent-amber',
      }
    case 'note':
      return {
        type: 'note',
        label: 'Note',
        pluralLabel: 'Notes',
        icon: FileText,
        badgeColor: 'bg-accent-purple/10',
        badgeBorder: 'border-accent-purple/20',
        badgeText: 'text-accent-purple',
      }
    case 'resource':
      return {
        type: 'resource',
        label: 'Resource',
        pluralLabel: 'Resources',
        icon: Link2,
        badgeColor: 'bg-cyan-500/10',
        badgeBorder: 'border-cyan-500/20',
        badgeText: 'text-cyan-400',
      }
    default:
      return {
        type: 'note',
        label: 'Entity',
        pluralLabel: 'Entities',
        icon: AlertTriangle,
        badgeColor: 'bg-zinc-500/10',
        badgeBorder: 'border-zinc-500/20',
        badgeText: 'text-zinc-400',
      }
  }
}

/**
 * Resolves a single entity from Dexie database with graceful missing/deleted handling.
 */
export async function resolveEntity(
  type: KnowledgeEntityType,
  id: string
): Promise<ResolvedEntity> {
  try {
    switch (type) {
      case 'project': {
        const p = await db.projects.get(id)
        if (!p) {
          return {
            id,
            type,
            title: 'Entity no longer exists',
            subtitle: 'The referenced project was deleted',
            isDeleted: true,
          }
        }
        return {
          id: p.id,
          type: 'project',
          title: p.name,
          identifier: p.identifier,
          subtitle: p.description,
          icon: p.icon || '📁',
          routeUrl: `/projects/${p.id}`,
          status: p.status,
          priority: p.priority,
          isDeleted: false,
          raw: p,
        }
      }

      case 'task': {
        const t = await db.tasks.get(id)
        if (!t) {
          return {
            id,
            type,
            title: 'Entity no longer exists',
            subtitle: 'The referenced task was deleted',
            isDeleted: true,
          }
        }

        let projectIdentifier: string | undefined
        if (t.projectId) {
          const p = await db.projects.get(t.projectId)
          projectIdentifier = p?.identifier
        }

        return {
          id: t.id,
          type: 'task',
          title: t.title,
          identifier: projectIdentifier,
          routeUrl: t.projectId ? `/projects/${t.projectId}` : '/my-tasks',
          status: t.status,
          priority: t.priority,
          isDeleted: false,
          raw: t,
        }
      }

      case 'session': {
        const s = await db.sessions.get(id)
        if (!s) {
          return {
            id,
            type,
            title: 'Entity no longer exists',
            subtitle: 'The referenced session was deleted',
            isDeleted: true,
          }
        }
        return {
          id: s.id,
          type: 'session',
          title: s.title || s.objective || 'Focus Session',
          subtitle: s.objective,
          routeUrl: `/sessions`,
          status: s.status,
          isDeleted: false,
          raw: s,
        }
      }

      case 'note': {
        const n = await db.notes.get(id)
        if (!n || n.deletedAt) {
          return {
            id,
            type,
            title: 'Entity no longer exists',
            subtitle: 'The referenced note was moved to trash or deleted',
            isDeleted: true,
          }
        }
        return {
          id: n.id,
          type: 'note',
          title: n.title || 'Untitled Note',
          subtitle: n.plainText ? n.plainText.slice(0, 120) : undefined,
          routeUrl: n.projectId ? `/projects/${n.projectId}` : undefined,
          isDeleted: false,
          raw: n,
        }
      }

      case 'resource': {
        const r = await db.resources.get(id)
        if (!r || r.deletedAt) {
          return {
            id,
            type,
            title: 'Entity no longer exists',
            subtitle: 'The referenced resource was moved to trash or deleted',
            isDeleted: true,
          }
        }
        return {
          id: r.id,
          type: 'resource',
          title: r.title || 'Untitled Resource',
          subtitle: r.description,
          externalUrl: sanitizeResourceUrl(r.url),
          routeUrl: r.projectId ? `/projects/${r.projectId}` : undefined,
          isDeleted: false,
          raw: r,
        }
      }

      default:
        return {
          id,
          type,
          title: 'Unknown Entity',
          isDeleted: true,
        }
    }
  } catch (err) {
    console.error(`Error resolving entity ${type}:${id}`, err)
    return {
      id,
      type,
      title: 'Entity no longer exists',
      subtitle: 'Unable to retrieve entity details',
      isDeleted: true,
    }
  }
}

/**
 * Reactively resolves an entity by type and ID.
 */
export function useResolvedEntity(
  type: KnowledgeEntityType,
  id?: string
): ResolvedEntity | null {
  return (
    useLiveQuery(
      async () => {
        if (!id) return null
        return resolveEntity(type, id)
      },
      [type, id]
    ) ?? null
  )
}

/**
 * Reactively resolves a collection of links (either incoming or outgoing)
 * and returns a map of linkId -> ResolvedEntity.
 */
export function useResolvedLinks(
  links: EntityLink[],
  direction: 'outgoing' | 'incoming'
): Record<string, ResolvedEntity> {
  const linkKeys = links.map((l) => `${l.id}-${l.sourceId}-${l.targetId}`).join(',')

  return (
    useLiveQuery(
      async () => {
        const resolvedMap = Object.create(null) as Record<string, ResolvedEntity>
        await Promise.all(
          links.map(async (link) => {
            const targetType = direction === 'outgoing' ? link.targetType : link.sourceType
            const targetId = direction === 'outgoing' ? link.targetId : link.sourceId
            const entity = await resolveEntity(targetType, targetId)
            resolvedMap[link.id] = entity
          })
        )
        return resolvedMap
      },
      [linkKeys, direction]
    ) ?? EMPTY_RESOLVED_LINKS
  )
}
