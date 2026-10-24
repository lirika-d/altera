import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Timer,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useProjects } from '@/hooks/useProjects'
import { useMyTasks } from '@/hooks/useTasks'
import { useActiveSession } from '@/hooks/useSessions'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, setIsCreateProjectOpen } = useAppStore()
  const allProjects = useProjects() || []
  const myTasks = useMyTasks(50) || []
  const activeSession = useActiveSession()
  const activeProjects = allProjects.filter((p) => p.status === 'active')

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
      hasActiveDot: false,
    },
    {
      to: '/projects',
      label: 'Projects',
      icon: FolderKanban,
      badge: allProjects.length > 0 ? String(allProjects.length) : undefined,
      hasActiveDot: false,
    },
    {
      to: '/my-tasks',
      label: 'My Tasks',
      icon: CheckSquare,
      badge: myTasks.length > 0 ? String(myTasks.length) : undefined,
      hasActiveDot: false,
    },
    {
      to: '/sessions',
      label: 'Sessions',
      icon: Timer,
      badge: activeSession ? (
        <span className="flex items-center gap-1 font-mono text-[9px] text-accent-green">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
          {activeSession.status === 'running' ? 'Active' : 'Paused'}
        </span>
      ) : undefined,
      hasActiveDot: !!activeSession,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      badge: undefined,
      hasActiveDot: false,
    },
  ]

  return (
    <aside
      className={cn(
        'relative flex flex-col justify-between h-screen border-r border-border-subtle bg-bg-surface select-none transition-all duration-200 z-30',
        sidebarCollapsed ? 'w-[48px]' : 'w-[220px]'
      )}
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Workspace Brand Header */}
        <div className="flex items-center justify-between h-11 px-3 border-b border-border-subtle">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-tr from-accent-blue to-accent-purple text-white shadow-sm shrink-0">
                <span className="font-bold text-[11px] leading-none">A</span>
              </div>
              <span className="font-semibold text-xs text-text-primary tracking-wide uppercase truncate">
                ALTERA
              </span>
              <span className="font-mono text-[9px] px-1 py-0.2 bg-white/5 border border-border-subtle rounded text-text-muted">
                LOCAL
              </span>
            </div>
          ) : (
            <div className="mx-auto flex h-6 w-6 items-center justify-center rounded bg-gradient-to-tr from-accent-blue to-accent-purple text-white shadow-sm">
              <span className="font-bold text-xs leading-none">A</span>
            </div>
          )}

          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick New Project Button */}
        <div className="p-2">
          {!sidebarCollapsed ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsCreateProjectOpen(true)}
              className="w-full justify-start gap-2 bg-bg-elevated/70 border-border text-xs text-text-primary hover:bg-bg-hover shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-accent-blue" />
              <span>New Project</span>
            </Button>
          ) : (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="flex h-8 w-8 mx-auto items-center justify-center rounded-md bg-bg-elevated border border-border text-text-primary hover:bg-bg-hover transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-accent-blue" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">New Project</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Primary Navigation */}
        <nav className="px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const content = (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2.5 h-8 px-2 rounded-md text-xs font-medium transition-colors duration-100',
                    isActive
                      ? 'bg-bg-elevated text-text-primary font-semibold shadow-sm border border-border/50'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60 border border-transparent',
                    sidebarCollapsed && 'justify-center px-0 w-8 mx-auto'
                  )
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {sidebarCollapsed && item.hasActiveDot && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
                )}
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {item.badge !== undefined &&
                      (typeof item.badge === 'string' || typeof item.badge === 'number' ? (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-bg-base border border-border-subtle text-text-muted">
                          {item.badge}
                        </span>
                      ) : (
                        item.badge
                      ))}
                  </>
                )}
              </NavLink>
            )

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.to} delayDuration={200}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                    {item.hasActiveDot ? ' (Active)' : ''}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return content
          })}
        </nav>

        {/* Active Projects Quick Jump (When Expanded) */}
        {!sidebarCollapsed && activeProjects.length > 0 && (
          <div className="mt-4 px-2 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                Active Projects
              </span>
              <span className="text-[10px] text-text-muted font-mono">
                {activeProjects.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {activeProjects.slice(0, 6).map((proj) => (
                <NavLink
                  key={proj.id}
                  to={`/projects/${proj.id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 h-7 px-2 rounded-md text-[11px] transition-colors',
                      isActive
                        ? 'bg-bg-elevated text-text-primary font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    )
                  }
                >
                  <span className="text-xs shrink-0">{proj.icon || '📁'}</span>
                  <span className="truncate flex-1">{proj.name}</span>
                  <span className="font-mono text-[9px] text-text-muted shrink-0">
                    {proj.progress}%
                  </span>
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom User / Toggle rail */}
      <div className="p-2 border-t border-border-subtle">
        {sidebarCollapsed ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="flex h-8 w-8 mx-auto items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between px-2 py-1 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
              IndexedDB Ready
            </span>
            <span className="font-mono text-[10px]">v1.0.0</span>
          </div>
        )}
      </div>
    </aside>
  )
}
