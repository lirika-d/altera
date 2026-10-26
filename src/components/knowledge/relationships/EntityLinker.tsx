import * as React from 'react'
import type {
  KnowledgeEntityType,
  EntityLink,
} from '@/types'
import {
  useEntityLinks,
  useNotes,
  useResources,
  useKnowledgeActions,
} from '@/hooks/useKnowledge'
import { useProjects } from '@/hooks/useProjects'
import { useAllTasks } from '@/hooks/useTasks'
import { useAllSessions } from '@/hooks/useSessions'
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
  Link2,
  Search,
  Plus,
  Check,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react'
import { getEntityTypeConfig } from './entityResolver'
import { useTranslation } from '@/i18n'

export type TabCategory = 'all' | 'project' | 'task' | 'session' | 'note' | 'resource'

export interface EntityLinkerProps {
  sourceType: KnowledgeEntityType
  sourceId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  onLinkCreated?: (link: EntityLink) => void
  className?: string
  disabled?: boolean
}

interface CandidateEntity {
  id: string
  type: KnowledgeEntityType
  title: string
  identifier?: string
  subtitle?: string
  icon?: string
}

/**
 * EntityLinker — Modal to select and link the current entity to any Project,
 * Task, Session, Note, or Resource with search, category tabs, self-link,
 * and duplicate link prevention.
 */
export function EntityLinker({
  sourceType,
  sourceId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  onLinkCreated,
  className,
  disabled = false,
}: EntityLinkerProps) {
  const { tx } = useTranslation()
  // Support both controlled and uncontrolled open state
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    controlledOnOpenChange?.(nextOpen)
    if (!nextOpen) {
      setSearch('')
      setSelectedTab('all')
      setErrorMessage(null)
    }
  }

  // State
  const [selectedTab, setSelectedTab] = React.useState<TabCategory>('all')
  const [search, setSearch] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [linkingEntityId, setLinkingEntityId] = React.useState<string | null>(null)
  const [recentlyLinkedIds, setRecentlyLinkedIds] = React.useState<Set<string>>(new Set())

  // Data queries
  const { createEntityLink } = useKnowledgeActions()
  const existingLinks = useEntityLinks(sourceType, sourceId)
  const rawProjects = useProjects()
  const rawTasks = useAllTasks()
  const rawSessions = useAllSessions()
  const rawNotes = useNotes()
  const rawResources = useResources()

  // Track existing outgoing links: "targetType:targetId"
  const existingOutgoingKeys = React.useMemo(() => {
    const set = new Set<string>()
    for (const link of existingLinks.outgoing) {
      set.add(`${link.targetType}:${link.targetId}`)
    }
    return set
  }, [existingLinks.outgoing])

  // Build candidate items list
  const allCandidates = React.useMemo<CandidateEntity[]>(() => {
    const list: CandidateEntity[] = []
    const projects = rawProjects ?? []
    const tasks = rawTasks ?? []
    const sessions = rawSessions ?? []
    const notes = rawNotes ?? []
    const resources = rawResources ?? []

    // 1. Projects
    for (const p of projects) {
      list.push({
        id: p.id,
        type: 'project',
        title: p.name,
        identifier: p.identifier,
        subtitle: p.description,
        icon: p.icon || '📁',
      })
    }

    // 2. Tasks
    for (const t of tasks) {
      list.push({
        id: t.id,
        type: 'task',
        title: t.title,
        identifier: t.project?.identifier,
        subtitle: t.project ? `In ${t.project.name}` : undefined,
      })
    }

    // 3. Sessions
    for (const s of sessions) {
      list.push({
        id: s.id,
        type: 'session',
        title: s.title || s.objective || 'Focus Session',
        subtitle: s.objective,
      })
    }

    // 4. Notes (active only)
    for (const n of notes) {
      if (!n.deletedAt) {
        list.push({
          id: n.id,
          type: 'note',
          title: n.title || 'Untitled Note',
          subtitle: n.plainText ? n.plainText.slice(0, 80) : undefined,
        })
      }
    }

    // 5. Resources (active only)
    for (const r of resources) {
      if (!r.deletedAt) {
        list.push({
          id: r.id,
          type: 'resource',
          title: r.title || 'Untitled Resource',
          subtitle: r.description || r.url,
        })
      }
    }

    return list
  }, [rawProjects, rawTasks, rawSessions, rawNotes, rawResources])

  // Filter candidates by category and search query
  const filteredCandidates = React.useMemo(() => {
    const q = search.trim().toLowerCase()

    return allCandidates.filter((item) => {
      // Tab filter
      if (selectedTab !== 'all' && item.type !== selectedTab) {
        return false
      }

      // Search filter
      if (q) {
        const titleMatch = item.title.toLowerCase().includes(q)
        const idMatch = item.identifier?.toLowerCase().includes(q)
        const subtitleMatch = item.subtitle?.toLowerCase().includes(q)
        if (!titleMatch && !idMatch && !subtitleMatch) {
          return false
        }
      }

      return true
    })
  }, [allCandidates, selectedTab, search])

  // Tab counts
  const tabCounts = React.useMemo(() => {
    return {
      all: allCandidates.length,
      project: (rawProjects ?? []).length,
      task: (rawTasks ?? []).length,
      session: (rawSessions ?? []).length,
      note: (rawNotes ?? []).filter((n) => !n.deletedAt).length,
      resource: (rawResources ?? []).filter((r) => !r.deletedAt).length,
    }
  }, [allCandidates.length, rawProjects, rawTasks, rawSessions, rawNotes, rawResources])

  // Handle creating the link
  const handleCreateLink = async (target: CandidateEntity) => {
    // 1. Self-link check
    if (sourceType === target.type && sourceId === target.id) {
      setErrorMessage(tx('Cannot link an entity to itself'))
      return
    }

    // 2. Duplicate link check
    const linkKey = `${target.type}:${target.id}`
    if (existingOutgoingKeys.has(linkKey) || recentlyLinkedIds.has(target.id)) {
      setErrorMessage(tx('This entity is already linked'))
      return
    }

    setLinkingEntityId(target.id)
    setErrorMessage(null)

    try {
      const link = await createEntityLink(
        sourceType,
        sourceId,
        target.type,
        target.id
      )
      setRecentlyLinkedIds((prev) => new Set([...prev, target.id]))
      onLinkCreated?.(link)
    } catch (err) {
      console.error('Failed to create link:', err)
      setErrorMessage(tx('Failed to establish relationship'))
    } finally {
      setLinkingEntityId(null)
    }
  }

  return (
    <>
      {/* Trigger Button */}
      {trigger ? (
        <span onClick={() => handleOpenChange(true)}>{trigger}</span>
      ) : (
        <Button
          variant="outline"
          size="xs"
          disabled={disabled}
          onClick={() => handleOpenChange(true)}
          className={cn(
            'h-6 gap-1.5 text-[11px] text-text-secondary hover:text-text-primary border-border-subtle hover:border-border',
            className
          )}
        >
          <Link2 className="h-3 w-3 text-accent-blue" />
          <span>{tx("Link Entity")}</span>
        </Button>
      )}

      {/* Linker Dialog */}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden sm:rounded-xl">
          {/* Header */}
          <DialogHeader className="p-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
                <Link2 className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-sm font-semibold text-text-primary">
                  {tx("Link Entity")}</DialogTitle>
                <DialogDescription className="text-xs text-text-muted">
                  {tx("Connect this item with projects, tasks, sessions, notes, or resources.")}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Search Bar */}
          <div className="p-3 bg-bg-base/60 border-b border-border-subtle">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setErrorMessage(null)
                }}
                placeholder={tx("Search across projects, tasks, notes, sessions...")}
                className="h-8 pl-8 pr-7 text-xs bg-bg-surface border-border-subtle"
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

            {/* Error Banner */}
            {errorMessage && (
              <div className="mt-2 flex items-center gap-1.5 rounded bg-accent-red/10 border border-accent-red/20 px-2 py-1 text-xs text-accent-red">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-border-subtle overflow-x-auto text-xs">
            {(
              [
                { id: 'all', label: tx('All') },
                { id: 'project', label: tx('Projects') },
                { id: 'task', label: tx('Tasks') },
                { id: 'session', label: tx('Sessions') },
                { id: 'note', label: tx('Notes') },
                { id: 'resource', label: tx('Resources') },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-colors whitespace-nowrap',
                  selectedTab === tab.id
                    ? 'bg-accent-blue/15 text-accent-blue'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'text-[10px] px-1 py-0.2 rounded-full font-mono',
                    selectedTab === tab.id ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-elevated text-text-muted'
                  )}
                >
                  {tabCounts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          {/* Candidate Entities List */}
          <div className="max-h-80 overflow-y-auto p-3 space-y-1.5">
            {filteredCandidates.length === 0 ? (
              <div className="py-10 text-center text-xs text-text-muted">
                {search ? tx("No entities matched your search.") : tx("No entities in this category.")}
              </div>
            ) : (
              filteredCandidates.map((item) => {
                const isSelf = sourceType === item.type && sourceId === item.id
                const isAlreadyLinked =
                  existingOutgoingKeys.has(`${item.type}:${item.id}`) ||
                  recentlyLinkedIds.has(item.id)
                const isConnecting = linkingEntityId === item.id
                const config = getEntityTypeConfig(item.type)
                const IconComponent = config.icon

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={cn(
                      'group flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors',
                      isSelf || isAlreadyLinked
                        ? 'border-border-subtle/50 bg-bg-base/40 opacity-75'
                        : 'border-border-subtle bg-bg-surface hover:border-border hover:bg-bg-elevated/70'
                    )}
                  >
                    {/* Entity Info */}
                    <div className="flex items-center gap-2.5 min-w-0 mr-2">
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs',
                          config.badgeColor,
                          config.badgeBorder,
                          config.badgeText
                        )}
                        title={tx(config.label)}
                      >
                        <IconComponent className="h-3.5 w-3.5" />
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.identifier && (
                            <span className="font-mono text-[10px] text-accent-blue font-semibold shrink-0">
                              {item.identifier}
                            </span>
                          )}
                          <span className="font-medium text-text-primary truncate">
                            {item.title}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="text-[11px] text-text-muted truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Button / Badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelf ? (
                        <Badge variant="outline" className="text-[10px] text-text-muted">
                          {tx("Current")}</Badge>
                      ) : isAlreadyLinked ? (
                        <Badge
                          variant="success"
                          className="text-[10px] gap-1 font-normal bg-accent-green/10 text-accent-green border-accent-green/20"
                        >
                          <Check className="h-2.5 w-2.5" />
                          <span>{tx("Linked")}</span>
                        </Badge>
                      ) : (
                        <Button
                          size="xs"
                          variant="secondary"
                          disabled={isConnecting}
                          onClick={() => handleCreateLink(item)}
                          className="h-6 px-2 text-[11px] gap-1 hover:bg-accent-blue hover:text-white transition-colors"
                        >
                          {isConnecting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                          <span>{tx("Connect")}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
