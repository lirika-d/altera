import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  FolderKanban,
  CheckSquare,
  BookOpen,
  Timer,
  CalendarDays,
  BarChart3,
  ChevronDown,
  ChevronRight,
  MoreVertical,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/useAppStore'
import { useProjects } from '@/hooks/useProjects'
import { useActiveSession, useLiveElapsedMs, formatTimer } from '@/hooks/useSessions'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const allProjects = useProjects() || []
  const activeSession = useActiveSession()
  const liveElapsedMs = useLiveElapsedMs(activeSession)
  const activeProjects = allProjects.filter((p) => p.status === 'active')

  // Clean navigation matching Stitch reference: Home icon for workspace, exact routes preserved
  const navItems = [
    {
      to: '/',
      label: t('nav.workspace'),
      icon: Home,
      end: true,
    },
    {
      to: '/projects',
      label: t('nav.projects'),
      icon: FolderKanban,
      end: false,
    },
    {
      to: '/my-tasks',
      label: t('nav.tasks'),
      icon: CheckSquare,
      end: false,
    },
    {
      to: '/knowledge',
      label: t('nav.knowledge'),
      icon: BookOpen,
      end: false,
    },
    {
      to: '/sessions',
      label: t('nav.sessions'),
      icon: Timer,
      end: false,
    },
    {
      to: '/calendar',
      label: t('nav.calendar'),
      icon: CalendarDays,
      end: false,
    },
    {
      to: '/insights',
      label: t('nav.insights'),
      icon: BarChart3,
      end: false,
    },
  ]

  const activeSessionProject = allProjects.find((p) => p.id === activeSession?.projectId)

  return (
    <aside
      className={cn(
        'altera-sidebar relative max-md:hidden flex flex-col justify-between h-screen border-r border-border-subtle bg-[#10110f] select-none transition-[width] duration-200 z-30 shrink-0',
        sidebarCollapsed ? 'w-[56px]' : 'w-[216px]'
      )}
    >
      {/* ─── Top Section ─── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Brand Header — seamless with no bottom border */}
        <div
          className={cn(
            'flex items-center h-12 shrink-0',
            sidebarCollapsed ? 'justify-center px-0' : 'px-4'
          )}
        >
          {!sidebarCollapsed ? (
            <NavLink to="/" className="flex items-center gap-2.5 overflow-hidden group">
              <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-accent-olive text-[#121210] font-serif font-bold text-xs shrink-0 shadow-xs transition-transform group-hover:scale-105">
                <span>A</span>
              </div>
              <div className="flex flex-col leading-none overflow-hidden">
                <span className="font-serif font-normal text-[13px] text-[#f2ede4] tracking-[0.22em] uppercase truncate">
                  ALTERA
                </span>
              </div>
            </NavLink>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-accent-olive text-[#121210] hover:brightness-110 transition-all"
              title={t('sidebar.expandSidebar')}
            >
              <span className="font-serif font-bold text-xs leading-none">
                A
              </span>
            </button>
          )}
        </div>

        {/* Navigation Category Label with subtle dropdown chevron */}
        {!sidebarCollapsed && (
          <div className="px-3.5 pt-2.5 pb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
              {t('nav.navigation')}
            </span>
            <ChevronDown className="h-3 w-3 text-[#828075]/60" />
          </div>
        )}

        {/* Primary Navigation List: 14px text-sm, h-9.5 row height */}
        <nav className={cn('space-y-1 mt-0.5', sidebarCollapsed ? 'px-2' : 'px-2.5')}>
          {navItems.map((item) => {
            const Icon = item.icon
            const content = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 h-9 rounded-md text-[13px] transition-colors duration-150',
                    sidebarCollapsed ? 'justify-center px-0 w-9 h-9 mx-auto' : 'px-3',
                    isActive
                      ? 'bg-bg-elevated text-text-primary font-semibold border border-border/70 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-accent-olive'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50 border border-transparent font-normal'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? 'text-accent-olive' : 'text-[#828075] group-hover:text-text-secondary'
                      )}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate flex-1 tracking-[-0.01em]">{item.label}</span>
                    )}
                  </>
                )}
              </NavLink>
            )

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.to} delayDuration={150}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.to}>{content}</div>
          })}
        </nav>

        {/* ─── Favorites / Active Projects Section ─── */}
        {!sidebarCollapsed && (
          <div className="mt-5 px-2.5 flex-1 overflow-y-auto">
              <div className="px-1 flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                {t('sidebar.favorites')}
              </span>
              <ChevronDown className="h-3 w-3 text-[#828075]/60" />
            </div>

            <div className="space-y-0.5">
              {activeProjects.slice(0, 5).map((proj, idx) => (
                <NavLink
                  key={proj.id}
                  to={`/projects/${proj.id}`}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 h-8 px-3 rounded-md text-[13px] transition-colors',
                      isActive
                        ? 'bg-bg-elevated text-text-primary font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/50 font-normal'
                    )
                  }
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full shrink-0',
                      idx === 0 ? 'bg-accent-olive' : 'bg-[#6b6960]'
                    )}
                  />
                  <span className="truncate flex-1">{proj.name}</span>
                </NavLink>
              ))}

              {activeProjects.length === 0 && (
                <div className="text-xs text-text-muted px-3 py-1.5 italic">
                  {t('dashboard.noProjects')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Section: Focus Widget + User Profile ─── */}
      <div className="p-3 border-t border-border-subtle space-y-3 shrink-0 bg-[#10110f]">
        {/* Focus Session Card matching Stitch */}
        {!sidebarCollapsed ? (
          <div
            onClick={() => navigate('/sessions')}
            className="p-3 rounded-md border border-border bg-bg-base hover:border-[#3a3d34] transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#828075]">
                {t('sidebar.focus')}
              </span>
              <span className="text-xs font-sans text-accent-olive font-medium flex items-center gap-1.5">
                {activeSession ? (
                  <>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        activeSession.status === 'running'
                          ? 'bg-accent-olive animate-pulse'
                          : 'bg-accent-amber'
                      )}
                    />
                    {activeSession.status === 'running'
                      ? t('sidebar.active')
                      : t('sidebar.paused')}
                  </>
                ) : <span className="text-text-muted" aria-label={t('sidebar.noActiveSession')}>—</span>}
              </span>
            </div>

            <div className="font-serif text-[25px] leading-tight font-normal text-[#f2ede4] tracking-normal my-1">
              {activeSession ? formatTimer(liveElapsedMs) : '00:00'}
            </div>

            <p className="text-xs text-[#9c9a8e] truncate mt-0.5 font-normal">
              {activeSession?.title || activeSessionProject?.name || t('sidebar.noActiveSession')}
            </p>
          </div>
        ) : (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate('/sessions')}
                className="flex flex-col items-center justify-center h-10 w-10 mx-auto rounded-lg border border-border-subtle bg-bg-base/70 hover:bg-bg-elevated transition-colors text-accent-olive"
              >
                <Timer className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('sidebar.focus')}: {activeSession ? formatTimer(liveElapsedMs) : '00:00'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* User Profile */}
        {!sidebarCollapsed ? (
          <div className="flex items-center justify-between pt-0.5 px-0.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#20251b] border border-[#30372a] text-[#a1af8c] text-xs font-serif font-semibold shrink-0" aria-hidden="true">
                А
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-text-primary leading-tight truncate">
                  Алекс Морган
                </div>
                <div className="text-xs text-[#828075] leading-none mt-1">
                  {t('sidebar.proPlan')}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="p-1.5 rounded-md text-[#828075] hover:text-text-primary hover:bg-bg-hover transition-colors"
              title={t('nav.settings')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title={t('sidebar.expandSidebar')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
