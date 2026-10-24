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
        const matchTitle = session.title.toLowerCase().includes(q)
        const matchAcc = session.accomplishments?.toLowerCase().includes(q)
        const matchObjective = session.objective?.toLowerCase().includes(q)
        const matchProj = project?.name.toLowerCase().includes(q) || project?.identifier.toLowerCase().includes(q)
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
    if (d.toDateString() === today.toDateString()) {
      return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const renderOutcomeBadge = (outcome?: string) => {
    if (outcome === 'completed') {
      return (
        <Badge variant="success" className="gap-1 font-mono text-[9px] px-1.5 py-0">
          <CheckCircle2 className="h-2.5 w-2.5" />
          <span>Completed</span>
        </Badge>
      )
    }
    if (outcome === 'progress') {
      return (
        <Badge variant="default" className="gap-1 font-mono text-[9px] px-1.5 py-0">
          <Clock className="h-2.5 w-2.5" />
          <span>Progress</span>
        </Badge>
      )
    }
    if (outcome === 'blocked') {
      return (
        <Badge variant="warning" className="gap-1 font-mono text-[9px] px-1.5 py-0">
          <AlertCircle className="h-2.5 w-2.5" />
          <span>Blocked</span>
        </Badge>
      )
    }
    return outcome ? (
      <Badge variant="secondary" className="font-mono text-[9px] px-1.5 py-0 capitalize">
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
    <div className="space-y-3">
      {/* Header and Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Session History
            </h2>
            <span className="font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded-full bg-bg-surface border border-border">
              {filteredSessions.length}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Log of completed work blocks, outcomes, and accomplishments.
          </p>
        </div>

        {/* Filter Controls Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-44 sm:w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            <Input
              placeholder="Search history…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-8 text-xs bg-bg-surface"
            />
          </div>

          {/* Project Filter */}
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-36 h-7 text-xs bg-bg-surface">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {allProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{p.icon || '📁'}</span>
                    <span className="truncate">{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Tabs */}
          <div className="flex items-center bg-bg-surface border border-border-subtle rounded-md p-0.5 gap-0.5 text-[11px]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'Month' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={cn(
                  'h-6 px-2 rounded text-[11px] font-medium transition-colors',
                  dateFilter === tab.id
                    ? 'bg-bg-elevated text-text-primary shadow-sm border border-border/60'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
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
              className="gap-1 text-text-muted hover:text-text-primary"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* History List Container */}
      <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
        {filteredSessions.length > 0 ? (
          <div className="divide-y divide-border-subtle/60">
            {filteredSessions.map((s) => {
              const project = projectMap.get(s.projectId)
              const taskTitle = s.taskId ? taskMap.get(s.taskId) : undefined

              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSession({ ...s, project, taskTitle })}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 hover:bg-bg-elevated transition-colors duration-150 cursor-pointer"
                >
                  {/* Left: Project tag, Title, Accomplishments */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {project && (
                        <span className="flex items-center gap-1 font-mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle shrink-0">
                          <span>{project.icon || '📁'}</span>
                          <span>{project.identifier}</span>
                        </span>
                      )}

                      <span className="text-xs font-semibold text-text-primary truncate group-hover:text-accent-blue transition-colors">
                        {s.title}
                      </span>

                      {s.status === 'paused' && (
                        <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-accent-amber/10 border border-accent-amber/30 text-accent-amber shrink-0">
                          PAUSED
                        </span>
                      )}
                    </div>

                    {/* Accomplishment summary or objective snippet */}
                    <p className="text-[11px] text-text-secondary truncate pl-0.5">
                      {s.accomplishments || s.objective || (
                        <span className="text-text-muted italic">No accomplishment summary recorded</span>
                      )}
                    </p>
                  </div>

                  {/* Right: Outcome badge, Date, Duration, Arrow */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {renderOutcomeBadge(s.outcome)}

                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-text-primary">
                        {formatDuration(s.accumulatedDurationMs)}
                      </div>
                      <div className="font-mono text-[10px] text-text-muted">
                        {formatDate(s.startedAt)}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : isFiltered ? (
          <EmptyState
            icon={Filter}
            title="No matching sessions"
            description="No sessions match the selected project, date range, or search query."
            actionLabel="Reset Filters"
            onAction={handleResetFilters}
          />
        ) : (
          <EmptyState
            icon={Timer}
            title="No sessions logged yet"
            description="Track your focus blocks and review what you accomplished right here."
            actionLabel="Start Your First Session"
            onAction={onStartNew}
          />
        )}
      </div>
    </div>
  )
}
