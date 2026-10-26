import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  FileText,
  Globe,
  Code,
  Paperclip,
  ArrowRight,
  ExternalLink,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotes, useResources } from '@/hooks/useKnowledge'
import { useProjects } from '@/hooks/useProjects'
import { CreateNoteDialog } from '@/components/knowledge/notes'
import { cn } from '@/lib/utils'
import { appRoutes } from '@/lib/appRoutes'
import { sanitizeResourceUrl } from '@/lib/resourceUrl'
import { useTranslation } from '@/i18n'

function formatRelativeTime(date: Date | string, language: string): string {
  const parsedDate = new Date(date)
  const diff = Date.now() - parsedDate.getTime()
  if (!Number.isFinite(diff)) return ''
  const relative = new Intl.RelativeTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    numeric: 'auto',
    style: 'narrow',
  })
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return relative.format(0, 'second')
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 30) return relative.format(-days, 'day')
  return parsedDate.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' })
}

export interface DashboardKnowledgeWidgetProps {
  className?: string
  limit?: number
}

interface UnifiedItem {
  id: string
  kind: 'note' | 'resource'
  title: string
  updatedAt: Date
  projectId?: string
  url?: string
  resourceType?: 'link' | 'snippet' | 'file'
  subtitle?: string
}

export function DashboardKnowledgeWidget({
  className,
  limit = 4,
}: DashboardKnowledgeWidgetProps) {
  const { tx, i18n } = useTranslation()
  const navigate = useNavigate()
  const notes = useNotes()
  const resources = useResources()
  const projects = useProjects() || []

  const [isCreateNoteOpen, setIsCreateNoteOpen] = React.useState(false)

  // Combine most recently edited notes and resources
  const recentItems = React.useMemo(() => {
    const list: UnifiedItem[] = []

    for (const note of notes) {
      if (!note.deletedAt) {
        list.push({
          id: note.id,
          kind: 'note',
          title: note.title || tx('Untitled Note'),
          updatedAt: new Date(note.updatedAt),
          projectId: note.projectId,
          subtitle: note.plainText ? note.plainText.slice(0, 60) : undefined,
        })
      }
    }

    for (const res of resources) {
      if (!res.deletedAt) {
        list.push({
          id: res.id,
          kind: 'resource',
          title: res.title || tx('Untitled Resource'),
          updatedAt: new Date(res.updatedAt),
          projectId: res.projectId,
          url: res.url,
          resourceType: res.type,
          subtitle: res.description || res.url || res.language,
        })
      }
    }

    list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    return list.slice(0, limit)
  }, [notes, resources, limit, tx])

  const totalCount = notes.length + resources.length

  const handleItemClick = (item: UnifiedItem) => {
    if (item.kind === 'note') {
      navigate(appRoutes.knowledgeNote(item.id))
    } else {
      const safeUrl = sanitizeResourceUrl(item.url)
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer')
      } else {
        navigate(appRoutes.knowledgeResource(item.id))
      }
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm',
        className
      )}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-bg-elevated/40">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-accent-purple" />
          <h3 className="text-xs font-semibold text-text-primary">
            {tx("Recent Knowledge")}</h3>
          <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 bg-bg-base rounded border border-border-subtle">
            {totalCount}
          </span>
        </div>
        <Link
          to="/knowledge"
          className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors"
        >
          <span>{tx("View all in Knowledge Hub")}</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Item List */}
      {recentItems.length > 0 ? (
        <div className="divide-y divide-border-subtle">
          {recentItems.map((item) => {
            const project = item.projectId
              ? projects.find((p) => p.id === item.projectId)
              : undefined

            const isNote = item.kind === 'note'
            const Icon = isNote
              ? FileText
              : item.resourceType === 'link'
              ? Globe
              : item.resourceType === 'snippet'
              ? Code
              : Paperclip

            const iconClass = isNote
              ? 'text-accent-purple bg-accent-purple/10 border-accent-purple/20'
              : item.resourceType === 'link'
              ? 'text-accent-blue bg-accent-blue/10 border-accent-blue/20'
              : item.resourceType === 'snippet'
              ? 'text-accent-purple bg-accent-purple/10 border-accent-purple/20'
              : 'text-accent-amber bg-accent-amber/10 border-accent-amber/20'

            return (
              <button
                type="button"
                key={`${item.kind}-${item.id}`}
                onClick={() => handleItemClick(item)}
                className="group flex w-full items-center justify-between gap-3 border-0 bg-transparent px-4 py-2.5 text-left text-xs hover:bg-bg-elevated transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded border shrink-0',
                      iconClass
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                        {item.title}
                      </span>
                      {project && (
                        <span
                          className="font-mono text-[9px] text-text-muted px-1.5 py-0 rounded bg-bg-base border border-border-subtle shrink-0"
                          title={`Project: ${project.name}`}
                        >
                          {project.identifier}
                        </span>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-[10px] text-text-muted truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[10px] text-text-muted font-mono">
                  <span>{formatRelativeTime(item.updatedAt, i18n.language)}</span>
                  {item.url && (
                    <ExternalLink className="h-3 w-3 text-text-muted/60 group-hover:text-accent-blue transition-colors" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="p-6 text-center space-y-2">
          <p className="text-xs text-text-muted">{tx("No notes or resources captured yet.")}</p>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setIsCreateNoteOpen(true)}
            className="gap-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            <span>{tx("Create First Note")}</span>
          </Button>
        </div>
      )}

      {/* Quick Create Note Dialog */}
      <CreateNoteDialog
        open={isCreateNoteOpen}
        onOpenChange={setIsCreateNoteOpen}
        onCreated={(note) => navigate(`/knowledge?tab=notes&note=${note.id}`)}
      />
    </div>
  )
}
