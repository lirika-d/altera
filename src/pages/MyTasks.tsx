import * as React from 'react'
import { CheckCircle2, ListFilter } from 'lucide-react'
import { useActiveProjectTasks } from '@/hooks/useTasks'
import { TaskRow } from '@/components/shared/TaskRow'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { EmptyState } from '@/components/shared/EmptyState'
import type { TaskStatus, Priority } from '@/types'
import { cn } from '@/lib/utils'

export function MyTasks() {
  const allTasks = useActiveProjectTasks() || []
  const [statusFilter, setStatusFilter] = React.useState<'all' | TaskStatus>('all')
  const [priorityFilter, setPriorityFilter] = React.useState<'all' | Priority>('all')

  const totalCount = allTasks.length
  const doneCount = allTasks.filter((t) => t.status === 'done').length
  const progress = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  const filteredTasks = allTasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
    return true
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-text-primary">My Tasks</h1>
            <span className="font-mono text-[11px] text-text-muted px-2 py-0.5 rounded-full bg-bg-surface border border-border">
              {filteredTasks.length}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            Aggregated checklist of all tasks across your active projects.
          </p>
        </div>

        {/* Global Task Completion Meter */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-bg-surface">
          <div className="text-right">
            <div className="text-[10px] text-text-muted uppercase font-semibold">
              Done Ratio
            </div>
            <div className="text-xs font-mono font-bold text-text-primary">
              {doneCount}/{totalCount}
            </div>
          </div>
          <ProgressBar progress={progress} showPercentage size="sm" className="w-24" />
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-b border-border-subtle pb-3">
        {/* Status filters */}
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'todo', label: 'Todo' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'done', label: 'Done' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'h-6 px-2.5 rounded text-[11px] font-medium transition-colors',
                statusFilter === tab.id
                  ? 'bg-bg-elevated text-text-primary border border-border shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <ListFilter className="h-3 w-3 text-text-muted" />
          <span className="text-[11px] text-text-muted">Priority:</span>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'urgent', label: 'Urgent' },
              { id: 'high', label: 'High' },
              { id: 'medium', label: 'Med' },
              { id: 'low', label: 'Low' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPriorityFilter(p.id)}
              className={cn(
                'h-5 px-1.5 rounded text-[10px] font-mono transition-colors',
                priorityFilter === p.id
                  ? 'bg-accent-blue/15 text-accent-blue font-bold border border-accent-blue/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
        {filteredTasks.length > 0 ? (
          <div className="p-1 space-y-0.5 divide-y divide-border-subtle/50">
            {filteredTasks.map((task) => (
              <TaskRow key={task.id} task={task} showProject={true} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="No matching tasks"
            description="All tasks matching this filter are resolved or none exist."
          />
        )}
      </div>
    </div>
  )
}
