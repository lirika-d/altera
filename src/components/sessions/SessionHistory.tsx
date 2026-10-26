import * as React from 'react'
import {
  Timer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Search,
  ChevronRight,
  RotateCcw,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAllSessions, formatDuration } from '@/hooks/useSessions'
import { useProjects } from '@/hooks/useProjects'
import { useAllTasks } from '@/hooks/useTasks'
import { useMinuteNow } from '@/hooks/useMinuteNow'
import { useTranslation } from '@/i18n'
import type { Session, Project, Task } from '@/types'
import { cn } from '@/lib/utils'

interface SessionHistoryProps {
  onSelectSession: (session: Session & { project?: Project; taskTitle?: string }) => void
  onStartNew: () => void
}

type DateFilterType = 'all' | 'today' | 'week' | 'month'

const EMPTY_PROJECTS: Project[] = []
const EMPTY_TASKS: Task[] = []

export function SessionHistory({ onSelectSession, onStartNew }: SessionHistoryProps) {
  const { t, tx, i18n } = useTranslation()
  const allSessions = useAllSessions()
  const allProjects = useProjects() ?? EMPTY_PROJECTS
  const allTasks = useAllTasks() ?? EMPTY_TASKS
  const now = useMinuteNow()

  const [projectFilter, setProjectFilter] = React.useState<string>('all')
  const [dateFilter, setDateFilter] = React.useState<DateFilterType>('all')
  const [searchQuery, setSearchQuery] = React.useState('')

  // Map lookups
  const projectMap = React.useMemo(() => {
    return new Map(allProjects.map((p) => [p.id, p]))
  }, [allProjects])

  const taskMap = React.useMemo(() => {
    return new Map(allTasks.map((t) => [t.id, t.title]))
  }, [allTasks])

  // Filter sessions
  const filteredSessions = React.useMemo(() => {
    const todayStr = now.toDateString()

    const startOfWeek = new Date(now)
    const day = startOfWeek.getDay()
    const diffToMonday = (day === 0 ? -6 : 1) - day
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday)
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    return allSessions.filter((session) => {
      // The single unfinished session is already shown in ActiveSessionPanel.
      if (session.status !== 'completed') return false

      // Project filter
      if (projectFilter !== 'all' && session.projectId !== projectFilter) {
        return false
      }

      // Date filter
      const sessionDate = new Date(session.startedAt)
      if (dateFilter === 'today' && sessionDate.toDateString() !== todayStr) {
        return false
      }
      if (dateFilter === 'week' && sessionDate < startOfWeek) {
        return false
      }
      if (dateFilter === 'month' && sessionDate < startOfMonth) {
        return false
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const project = projectMap.get(session.projectId)
        const projectName = project?.name ?? session.projectSnapshot?.name
        const projectIdentifier = project?.identifier ?? session.projectSnapshot?.identifier
        const matchTitle = session.title.toLowerCase().includes(q)
        const matchAcc = session.accomplishments?.toLowerCase().includes(q)
        const matchObjective = session.objective?.toLowerCase().includes(q)
        const matchProj = projectName?.toLowerCase().includes(q) || projectIdentifier?.toLowerCase().includes(q)
        if (!matchTitle && !matchAcc && !matchObjective && !matchProj) {
          return false
        }
      }

      return true
    })
  }, [allSessions, projectFilter, dateFilter, searchQuery, projectMap, now])

  const formatDate = (date: Date) => {
    const d = new Date(date)
    const today = now
    const isRu = i18n.language === 'ru'
    if (d.toDateString() === today.toDateString()) {
      return isRu
        ? `Сегодня, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        : `Today, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    }
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) {
      return isRu
        ? `Вчера, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
        : `Yesterday, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    }
    return d.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' })
  }

  const renderOutcomeBadge = (outcome?: string) => {
    if (outcome === 'completed') {
      return (
        <Badge variant="success" className="gap-1 font-mono text-[10px] px-2 py-0.5 bg-[#8a9e6b]/15 text-[#8a9e6b] border-[#8a9e6b]/30">
          <CheckCircle2 className="h-3 w-3" />
          <span>{tx("Completed")}</span>
        </Badge>
      )
    }
    if (outcome === 'progress') {
      return (
        <Badge variant="default" className="gap-1 font-mono text-[10px] px-2 py-0.5 bg-[#1f201c] text-[#a3b899] border-[#2e2e28]">
          <Clock className="h-3 w-3" />
          <span>{tx("Progress")}</span>
        </Badge>
      )
    }
    if (outcome === 'blocked') {
      return (
        <Badge variant="warning" className="gap-1 font-mono text-[10px] px-2 py-0.5 bg-amber-500/15 text-amber-400 border-amber-500/30">
          <AlertCircle className="h-3 w-3" />
          <span>{tx("Blocked")}</span>
        </Badge>
      )
    }
    return outcome ? (
      <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0.5 capitalize bg-[#1a1a17] text-[#9ca3af] border-[#242420]">
        {outcome}
      </Badge>
    ) : null
  }

  const isFiltered = projectFilter !== 'all' || dateFilter !== 'all' || searchQuery.trim().length > 0

  const handleResetFilters = () => {
    setProjectFilter('all')
    setDateFilter('all')
    setSearchQuery('')
  }

  return (
    <div className="space-y-4">
      {/* Header and Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-lg md:text-xl font-medium tracking-tight text-[#eceeed]">
              {t('sessions.history.title')}
            </h2>
            <span className="font-mono text-xs text-[#8a9e6b] px-2.5 py-0.5 rounded-full bg-[#8a9e6b]/10 border border-[#8a9e6b]/25 font-semibold">
              {filteredSessions.length}
            </span>
          </div>
          <p className="text-xs text-[#9ca3af] mt-0.5">
            {tx("Log of completed work blocks, outcomes, and accomplishments.")}</p>
        </div>

        {/* Filter Controls Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6b7280] pointer-events-none" />
            <Input
              aria-label={t('sessions.history.searchPlaceholder')}
              placeholder={t('sessions.history.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8.5 text-xs bg-[#141412] border-[#242420] text-[#eceeed] placeholder:text-[#6b7280]"
            />
          </div>

          {/* Project Filter */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-38 h-8 text-xs bg-[#141412] border-[#242420] text-[#eceeed]">
              <SelectValue placeholder={t('sessions.history.filterProject')} />
            </SelectTrigger>
            <SelectContent className="bg-[#141412] border-[#242420] text-[#eceeed]">
              <SelectItem value="all">{t('sessions.history.filterProject')}</SelectItem>
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2 truncate">
                    <span>{p.icon || '📁'}</span>
                    <span className="truncate">{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Tabs */}
          <div className="flex items-center bg-[#141412] border border-[#242420] rounded-lg p-0.5 gap-1 text-xs">
            {(
              [
                { id: 'all', label: tx('All') },
                { id: 'today', label: tx('Today') },
                { id: 'week', label: tx('Week') },
                { id: 'month', label: tx('Month') },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={cn(
                  'h-6 px-2.5 rounded-md text-xs font-medium transition-all duration-150',
                  dateFilter === tab.id
                    ? 'bg-[#1f201c] text-[#8a9e6b] font-semibold border border-[#8a9e6b]/30 shadow-sm'
                    : 'text-[#9ca3af] hover:text-[#eceeed] hover:bg-[#1a1a17]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isFiltered && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleResetFilters}
              className="gap-1 text-[#9ca3af] hover:text-[#eceeed]"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{tx("Reset")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* History List Container */}
      <div className="rounded-xl border border-[#242420] bg-[#141412] overflow-hidden shadow-sm">
        {filteredSessions.length > 0 ? (
          <div className="divide-y divide-[#1f201c]">
            {filteredSessions.map((s) => {
              const project = projectMap.get(s.projectId)
              const projectSnapshot = s.projectSnapshot
              const taskTitle = s.taskId ? taskMap.get(s.taskId) : undefined

              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSession({ ...s, project, taskTitle })}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 hover:bg-[#1a1a17] transition-colors duration-150 cursor-pointer"
                >
                  {/* Left: Project tag, Title, Accomplishments */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      {(project || projectSnapshot) && (
                        <span
                          title={projectSnapshot && !project ? `${projectSnapshot.identifier} · ${projectSnapshot.name}` : project?.name}
                          className="flex items-center gap-1 font-mono text-[10px] text-[#8a9e6b] px-2 py-0.5 rounded bg-[#8a9e6b]/10 border border-[#8a9e6b]/20 shrink-0 font-medium"
                        >
                          <span>{project?.icon || '📁'}</span>
                          <span>{project?.identifier || projectSnapshot?.identifier}</span>
                          {projectSnapshot && !project && <span className="max-w-28 truncate text-text-muted">· {projectSnapshot.name}</span>}
                        </span>
                      )}

                      <span className="text-xs md:text-sm font-semibold text-[#eceeed] truncate group-hover:text-[#8a9e6b] transition-colors">
                        {s.title}
                      </span>

                      {s.status === 'paused' && (
                        <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                          {tx("PAUSED")}</span>
                      )}
                    </div>

                    {/* Accomplishment summary or objective snippet */}
                    <p className="text-xs text-[#9ca3af] truncate pl-0.5 font-sans">
                      {s.accomplishments || s.objective || (
                        <span className="text-[#6b7280] italic">{tx("No accomplishment summary recorded")}</span>
                      )}
                    </p>
                  </div>

                  {/* Right: Outcome badge, Date, Duration, Arrow */}
                  <div className="flex items-center gap-3.5 shrink-0 self-end sm:self-center">
                    {renderOutcomeBadge(s.outcome)}

                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-[#eceeed]">
                        {formatDuration(s.accumulatedDurationMs)}
                      </div>
                      <div className="font-mono text-[10px] text-[#6b7280]">
                        {formatDate(s.startedAt)}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-[#6b7280] group-hover:text-[#eceeed] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : isFiltered ? (
          <div className="py-12">
            <EmptyState
              icon={Filter}
              title={tx("No matching sessions")}
              description={t('sessions.history.noMatchesDesc')}
              actionLabel={t('sessions.history.resetFilters')}
              onAction={handleResetFilters}
            />
          </div>
        ) : (
          <div className="py-12">
            <EmptyState
              icon={Timer}
              title={t('sessions.history.noHistory')}
              description={t('sessions.history.noHistoryDesc')}
              actionLabel={t('sessions.newSession')}
              onAction={onStartNew}
            />
          </div>
        )}
      </div>
    </div>
  )
}
