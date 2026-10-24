import { useLocation, Link, useParams } from 'react-router-dom'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { useProject } from '@/hooks/useProjects'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/button'

export function Header() {
  const location = useLocation()
  const params = useParams<{ id?: string }>()
  const projectId = params.id || (location.pathname.startsWith('/projects/') ? location.pathname.split('/')[2] : undefined)
  const currentProject = useProject(projectId)
  const { setIsCreateProjectOpen } = useAppStore()

  // Generate dynamic breadcrumbs
  const renderBreadcrumbs = () => {
    const pathname = location.pathname

    if (pathname === '/') {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-text-primary">Dashboard</span>
        </div>
      )
    }

    if (pathname === '/projects') {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-text-muted">Workspace</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" />
          <span className="font-medium text-text-primary">Projects</span>
        </div>
      )
    }

    if (pathname.startsWith('/projects/') && projectId) {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <Link
            to="/projects"
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            Projects
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" />
          <span className="font-mono text-accent-blue font-semibold">
            {currentProject?.identifier || '...'}
          </span>
          {currentProject?.name && (
            <>
              <span className="text-text-muted/50">•</span>
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
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-text-muted">Workspace</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" />
          <span className="font-medium text-text-primary">My Tasks</span>
        </div>
      )
    }

    if (pathname === '/sessions') {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-text-muted">Workspace</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" />
          <span className="font-medium text-text-primary">Work Sessions</span>
        </div>
      )
    }

    if (pathname === '/settings') {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-text-muted">Workspace</span>
          <ChevronRight className="h-3.5 w-3.5 text-text-muted/60" />
          <span className="font-medium text-text-primary">Settings</span>
        </div>
      )
    }

    return null
  }

  return (
    <header className="flex items-center justify-between h-11 px-6 border-b border-border-subtle bg-bg-base/80 backdrop-blur-sm z-20 shrink-0">
      {/* Breadcrumb path */}
      <div className="flex items-center min-w-0">{renderBreadcrumbs()}</div>

      {/* Quick Global Actions */}
      <div className="flex items-center gap-2">
        <Link
          to="/projects"
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated text-text-secondary hover:text-text-primary text-[11px] transition-colors"
        >
          <Search className="h-3 w-3" />
          <span>Search</span>
          <kbd className="font-mono text-[9px] bg-bg-base border border-border-subtle rounded px-1 py-0.2 text-text-muted">
            /
          </kbd>
        </Link>

        <Button
          size="xs"
          onClick={() => setIsCreateProjectOpen(true)}
          className="gap-1 shadow-sm"
        >
          <Plus className="h-3 w-3" />
          <span>New Project</span>
        </Button>
      </div>
    </header>
  )
}
