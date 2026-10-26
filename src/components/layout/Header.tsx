import { useLocation, Link, useParams } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CheckSquare,
  ChevronRight,
  FolderKanban,
  Home,
  Menu,
  Plus,
  Search,
  Timer,
  CalendarDays,
  BarChart3,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useProject } from '@/hooks/useProjects'
import { useAppStore } from '@/store/useAppStore'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

export function Header() {
  const { t, tx } = useTranslation()
  const location = useLocation()
  const params = useParams<{ id?: string }>()
  const projectId =
    params.id ||
    (location.pathname.startsWith('/projects/') ? location.pathname.split('/')[2] : undefined)
  const currentProject = useProject(projectId)
  const { setIsCreateProjectOpen } = useAppStore()
  const mobileNavItems = [
    { to: '/', label: t('nav.workspace'), icon: Home },
    { to: '/projects', label: t('nav.projects'), icon: FolderKanban },
    { to: '/my-tasks', label: t('nav.tasks'), icon: CheckSquare },
    { to: '/knowledge', label: t('nav.knowledge'), icon: BookOpen },
    { to: '/sessions', label: t('nav.sessions'), icon: Timer },
    { to: '/calendar', label: t('nav.calendar'), icon: CalendarDays },
    { to: '/insights', label: t('nav.insights'), icon: BarChart3 },
  ]

  // Generate dynamic breadcrumbs following Stitch style: "Личное › Пространство"
  const renderBreadcrumbs = () => {
    const pathname = location.pathname

    if (pathname === '/') {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-text-muted">{t('header.personal')}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-medium text-text-primary">{t('header.workspace')}</span>
        </div>
      )
    }

    if (pathname === '/projects') {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-text-muted">{t('header.personal')}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-medium text-text-primary">{t('header.projects')}</span>
        </div>
      )
    }

    if (pathname.startsWith('/projects/') && projectId) {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <Link
            to="/projects"
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            {t('header.projects')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-mono text-accent-olive font-semibold">
            {currentProject?.identifier || '...'}
          </span>
          {currentProject?.name && (
            <>
                <span className="text-text-muted/60">·</span>
                <span className="font-medium text-text-primary truncate max-w-xs">
                {currentProject.name}
              </span>
            </>
          )}
        </div>
      )
    }

    if (pathname === '/my-tasks') {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-text-muted">{t('header.personal')}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-medium text-text-primary">{t('header.tasks')}</span>
        </div>
      )
    }

    if (pathname === '/sessions') {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-text-muted">{t('header.personal')}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-medium text-text-primary">{t('header.sessions')}</span>
        </div>
      )
    }

    if (pathname === '/calendar') {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-text-muted">{t('header.personal')}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-medium text-text-primary">{t('header.calendar')}</span>
        </div>
      )
    }

    if (pathname === '/insights') {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-text-muted">{t('header.personal')}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-medium text-text-primary">{t('header.insights')}</span>
        </div>
      )
    }

    if (pathname.startsWith('/knowledge')) {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-text-muted">{t('header.personal')}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-medium text-text-primary">{t('header.knowledge')}</span>
        </div>
      )
    }

    if (pathname === '/settings') {
      return (
        <div className="flex items-center gap-1.5 text-xs select-none">
          <span className="text-text-muted">{t('header.personal')}</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" aria-hidden="true" />
          <span className="font-medium text-text-primary">{t('header.settings')}</span>
        </div>
      )
    }

    return null
  }

  return (
    <header className="h-12 border-b border-border-subtle bg-[#10110f] z-20 shrink-0">
      <div className="w-full px-5 sm:px-8 lg:px-10 h-full flex items-center justify-between">
        {/* Dynamic breadcrumb path */}
        <div className="flex items-center gap-2 min-w-0">
          <details key={location.pathname} className="relative md:hidden">
            <summary
              className="list-none [&::-webkit-details-marker]:hidden flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] border border-border-subtle bg-[#0d0e0c] text-text-secondary hover:text-text-primary"
              title={t('nav.navigation')}
            >
              <Menu className="h-4 w-4" />
            </summary>
            <nav className="fixed left-0 top-12 z-50 w-[min(17rem,100vw)] border-b border-r border-border bg-[#11120f] p-2 shadow-2xl">
              {mobileNavItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex h-10 items-center gap-3 rounded-[6px] px-3 text-sm text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                >
                  <Icon className="h-4 w-4 text-accent-olive" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </details>
          <div className="hidden sm:flex items-center min-w-0">{renderBreadcrumbs()}</div>
        </div>

        {/* Quick Global Actions matching Stitch */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('altera:open-command-palette'))}
            className="flex items-center gap-2 h-8 px-3 rounded-[6px] border border-border-subtle bg-[#0d0e0c] hover:bg-bg-elevated text-text-secondary hover:text-text-primary text-xs transition-colors"
            title={tx("Search (Ctrl+K / ⌘K)")}
          >
            <Search className="h-3.5 w-3.5 text-[#828075]" />
            <span className="hidden sm:inline text-[#9c9a8e] text-xs">{t('header.search')}</span>
          </button>

          <button
            type="button"
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-[6px] border border-border-subtle bg-[#0d0e0c] text-[#828075] hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title={tx("Notifications")}
          >
            <Bell className="h-3.5 w-3.5" />
          </button>

          <LanguageSwitcher />

          {/* High-contrast sand/cream primary action button */}
          <button
            type="button"
            onClick={() => setIsCreateProjectOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-md border border-accent-olive/60 text-xs font-semibold bg-accent-olive hover:brightness-110 text-[#171914] transition-colors select-none cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{t('header.newProject')}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
