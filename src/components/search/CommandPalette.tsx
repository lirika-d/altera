/**
 * CommandPalette.tsx — Global Multi-Entity Command Palette (Ctrl+K / Cmd+K)
 *
 * Implements:
 *   - Global keyboard listener (Ctrl+K, Cmd+K, '/' when unfocused, Escape to close)
 *   - Linear dark backdrop with blur (`bg-black/60 backdrop-blur-sm`)
 *   - Top search input with Search icon and Esc badge
 *   - Type filter pills with item counts: All, Projects, Tasks, Sessions, Notes, Resources
 *   - Arrow Up / Down navigation, Enter to select, mouse hover selection
 *   - Grouped results with distinct entity badges & icons
 *   - Quick Commands section (empty query or prefixed with `>`)
 *   - EmptyState component when no results match query
 *   - Fully accessible modal dialog with focus management
 */

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  X,
  CalendarDays,
  ChartNoAxesCombined,
  FolderGit2,
  CheckCircle2,
  Timer,
  FileText,
  Globe,
  Code,
  FileCode,
  CheckSquare,
  Settings,
  BookOpen,
  LayoutDashboard,
  Star,
  CornerDownLeft,
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useSearch } from './useSearch'
import {
  highlightMatches,
  type SearchEntityType,
  type SearchFilterType,
  type SearchResultItem,
} from './searchUtils'
import { cn } from '@/lib/utils'
import { appRoutes } from '@/lib/appRoutes'
import { useTranslation } from '@/i18n'
import { useWorkflowTemplates } from '@/hooks/useWorkflowTemplates'

// ─── Types & Interfaces ───────────────────────────────────────────────────────

export interface CommandCallbacks {
  onCreateNote?: () => void
  onAddResource?: () => void
  onNewProject?: () => void
  onStartSession?: () => void
  onNavigate?: (path: string) => void
  onSelectResult?: (item: SearchResultItem) => void
}

export interface CommandPaletteProps extends CommandCallbacks {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disableGlobalShortcuts?: boolean
}

interface CommandActionItem {
  id: string
  title: string
  description?: string
  shortcut?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  category: 'Quick Actions' | 'Navigation'
  run: () => void
}

// ─── Format Duration Helper ───────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0m'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${Math.max(1, minutes)}m`
}

function formatDate(date: Date | undefined, language: string): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' })
}

function commandOptionId(id: string): string {
  return `command-option-${encodeURIComponent(id)}`
}

function resultOptionId(item: SearchResultItem): string {
  return `result-option-${item.type}-${encodeURIComponent(item.id)}`
}

// ─── Safe Navigation Hook ─────────────────────────────────────────────────────

export function CommandPalette({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  disableGlobalShortcuts = false,
  onCreateNote,
  onAddResource,
  onNewProject,
  onStartSession,
  onNavigate,
  onSelectResult,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setIsOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOnOpenChange) {
        controlledOnOpenChange(nextOpen)
      }
      if (!isControlled) {
        setInternalOpen(nextOpen)
      }
    },
    [controlledOnOpenChange, isControlled]
  )

  const [query, setQuery] = React.useState('')
  const [activeFilter, setActiveFilter] = React.useState<SearchFilterType>('all')
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  const inputRef = React.useRef<HTMLInputElement>(null)
  const resultsContainerRef = React.useRef<HTMLDivElement>(null)
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([])

  const navigate = useNavigate()
  const { setIsCreateProjectOpen } = useAppStore()
  const { t, tx, i18n } = useTranslation()
  const workflowTemplates = useWorkflowTemplates(undefined, isOpen)

  const openPalette = React.useCallback(() => {
    setQuery('')
    setActiveFilter('all')
    setSelectedIndex(0)
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [setIsOpen])

  const closePalette = React.useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  // Multi-entity search data
  const { results: searchResults, counts } = useSearch(
    query.startsWith('>') ? '' : query,
    activeFilter,
    { enabled: isOpen }
  )

  // ── Global Keyboard Shortcuts (Ctrl+K, Cmd+K, '/', Escape) ─────────────────
  React.useEffect(() => {
    if (disableGlobalShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) {
          closePalette()
        } else {
          openPalette()
        }
        return
      }

      // 2. '/' shortcut when not focused on an input/editable
      if (e.key === '/' && !isOpen) {
        const target = e.target as HTMLElement | null
        const tagName = target?.tagName?.toLowerCase()
        const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select'
        const isEditable = target?.isContentEditable

        if (!isInput && !isEditable) {
          e.preventDefault()
          openPalette()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [disableGlobalShortcuts, isOpen, openPalette, closePalette])

  // Listen to custom open event
  React.useEffect(() => {
    if (disableGlobalShortcuts) return
    const handleCustomOpen = () => openPalette()
    window.addEventListener('altera:open-command-palette', handleCustomOpen)
    return () => window.removeEventListener('altera:open-command-palette', handleCustomOpen)
  }, [disableGlobalShortcuts, openPalette])

  // ── Navigation Action Handler ───────────────────────────────────────────────
  const handleNavigate = React.useCallback(
    (path: string) => {
      closePalette()
      if (onNavigate) {
        onNavigate(path)
      } else {
        navigate(path)
      }
    },
    [closePalette, onNavigate, navigate]
  )

  // ── Quick Commands Definitions ─────────────────────────────────────────────
  const commands: CommandActionItem[] = React.useMemo(() => {
    const baseCommands: CommandActionItem[] = [
      {
        id: 'create-note',
        title: tx('Create Note'),
        description: tx('Create a new markdown or rich-text note in Knowledge Hub'),
        icon: FileText,
        iconColor: 'text-accent-amber',
        category: 'Quick Actions',
        run: () => {
          setIsOpen(false)
          if (onCreateNote) {
            onCreateNote()
          } else {
            handleNavigate(appRoutes.createNote())
          }
        },
      },
      {
        id: 'add-resource',
        title: tx('Add Resource'),
        description: tx('Bookmark a link, snippet, or document in Knowledge Hub'),
        icon: Globe,
        iconColor: 'text-accent-blue',
        category: 'Quick Actions',
        run: () => {
          setIsOpen(false)
          if (onAddResource) {
            onAddResource()
          } else {
            handleNavigate(appRoutes.createResource())
          }
        },
      },
      {
        id: 'new-project',
        title: tx('New Project'),
        description: tx('Initialize a new project workspace with goals & tasks'),
        icon: FolderGit2,
        iconColor: 'text-accent-blue',
        category: 'Quick Actions',
        run: () => {
          setIsOpen(false)
          if (onNewProject) {
            onNewProject()
          } else {
            setIsCreateProjectOpen(true)
          }
        },
      },
      {
        id: 'start-session',
        title: tx('Start Session'),
        description: tx('Launch a timed deep work session linked to a project'),
        icon: Timer,
        iconColor: 'text-accent-purple',
        category: 'Quick Actions',
        run: () => {
          setIsOpen(false)
          if (onStartSession) {
            onStartSession()
          } else {
            handleNavigate(appRoutes.startSession())
          }
        },
      },
      {
        id: 'go-knowledge',
        title: tx('Go to Knowledge Hub'),
        description: tx('Explore notes, bookmarks, code snippets, and attachments'),
        icon: BookOpen,
        iconColor: 'text-accent-green',
        category: 'Navigation',
        run: () => handleNavigate('/knowledge'),
      },
      {
        id: 'go-dashboard',
        title: tx('Go to Dashboard'),
        description: tx('Workspace overview, active focus, and continuity cards'),
        icon: LayoutDashboard,
        iconColor: 'text-accent-blue',
        category: 'Navigation',
        run: () => handleNavigate('/'),
      },
      {
        id: 'go-tasks',
        title: tx('Go to My Tasks'),
        description: tx('Review prioritized todo items across active projects'),
        icon: CheckSquare,
        iconColor: 'text-accent-amber',
        category: 'Navigation',
        run: () => handleNavigate('/my-tasks'),
      },
      {
        id: 'go-settings',
        title: tx('Go to Settings'),
        description: tx('Database diagnostics, theme configuration, and storage info'),
        icon: Settings,
        iconColor: 'text-text-muted',
        category: 'Navigation',
        run: () => handleNavigate('/settings'),
      },
    ]
    const templateCommands: CommandActionItem[] = workflowTemplates.map(template => ({
      id: `use-template-${template.id}`,
      title: template.kind === 'task'
        ? t('commandPalette.createTaskFromTemplate', { name: template.name })
        : t('commandPalette.createProjectFromTemplate', { name: template.name }),
      description: template.kind === 'task' ? template.title : template.projectName,
      icon: template.kind === 'task' ? CheckSquare : FolderGit2,
      iconColor: template.kind === 'task' ? 'text-accent-amber' : 'text-accent-blue',
      category: 'Quick Actions',
      run: () => handleNavigate(template.kind === 'task'
        ? appRoutes.createTask(template.id)
        : appRoutes.createProjectFromTemplate(template.id)),
    }))
    return [
      ...baseCommands,
      {
        id: 'create-task',
        title: t('commandPalette.createTask'),
        description: t('commandPalette.createTaskDescription'),
        icon: CheckSquare,
        iconColor: 'text-accent-amber',
        category: 'Quick Actions',
        run: () => handleNavigate(appRoutes.createTask()),
      },
      {
        id: 'go-calendar',
        title: t('commandPalette.goCalendar'),
        description: t('commandPalette.goCalendarDescription'),
        icon: CalendarDays,
        iconColor: 'text-accent-green',
        category: 'Navigation',
        run: () => handleNavigate(appRoutes.calendar()),
      },
      {
        id: 'go-insights',
        title: t('commandPalette.goInsights'),
        description: t('commandPalette.goInsightsDescription'),
        icon: ChartNoAxesCombined,
        iconColor: 'text-accent-purple',
        category: 'Navigation',
        run: () => handleNavigate('/insights'),
      },
      ...templateCommands,
    ]
  }, [
    handleNavigate,
    onAddResource,
    onCreateNote,
    onNewProject,
    onStartSession,
    setIsCreateProjectOpen,
    setIsOpen,
    t,
    tx,
    workflowTemplates,
  ])

  // Filter commands based on query (if query starts with > or is general text)
  const matchingCommands = React.useMemo(() => {
    const isCommandPrefix = query.startsWith('>')
    const cleanQ = isCommandPrefix ? query.slice(1).trim().toLowerCase() : query.trim().toLowerCase()

    if (!cleanQ) {
      return commands
    }

    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(cleanQ) ||
        (cmd.description && cmd.description.toLowerCase().includes(cleanQ))
    )
  }, [commands, query])

  // Determine whether we are in pure command mode (starts with '>')
  const isCommandMode = query.startsWith('>')

  // Combined flat list of navigable items for keyboard Up/Down/Enter
  type NavItem =
    | { kind: 'command'; item: CommandActionItem }
    | { kind: 'result'; item: SearchResultItem }

  const navigableItems: NavItem[] = React.useMemo(() => {
    if (isCommandMode) {
      return matchingCommands.map((c) => ({ kind: 'command', item: c }))
    }

    if (!query.trim()) {
      // Empty query: show Quick Commands
      return matchingCommands.map((c) => ({ kind: 'command', item: c }))
    }

    // Commands are rendered only under the All filter; keyboard navigation must
    // not expose invisible commands while a specific entity filter is active.
    const items: NavItem[] = []
    if (activeFilter === 'all') {
      for (const cmd of matchingCommands) {
        items.push({ kind: 'command', item: cmd })
      }
    }
    for (const res of searchResults) {
      items.push({ kind: 'result', item: res })
    }
    return items
  }, [activeFilter, isCommandMode, matchingCommands, query, searchResults])

  const activeDescendantId = React.useMemo(() => {
    const activeItem = navigableItems[selectedIndex]
    if (!activeItem) return undefined
    return activeItem.kind === 'command'
      ? commandOptionId(activeItem.item.id)
      : resultOptionId(activeItem.item)
  }, [navigableItems, selectedIndex])

  // ── Result Selection Handler ───────────────────────────────────────────────
  const handleSelectResult = React.useCallback(
    (item: SearchResultItem) => {
      closePalette()
      if (onSelectResult) {
        onSelectResult(item)
        return
      }

      switch (item.type) {
        case 'project':
          handleNavigate(appRoutes.project(item.id))
          break
        case 'task':
          handleNavigate(appRoutes.task(item.id, item.metadata.projectId))
          break
        case 'session':
          handleNavigate(appRoutes.session(item.id))
          break
        case 'note':
          handleNavigate(appRoutes.knowledgeNote(item.id))
          break
        case 'resource':
          handleNavigate(appRoutes.knowledgeResource(item.id))
          break
      }
    },
    [handleNavigate, onSelectResult, closePalette]
  )

  // ── Keyboard Navigation within Palette ──────────────────────────────────────
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (navigableItems.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % navigableItems.length)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + navigableItems.length) % navigableItems.length)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const current = navigableItems[selectedIndex]
      if (current) {
        if (current.kind === 'command') {
          current.item.run()
        } else {
          handleSelectResult(current.item)
        }
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      return
    }
  }

  // Scroll active item into view
  React.useEffect(() => {
    const el = itemRefs.current[selectedIndex]
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // ── Render Helpers ─────────────────────────────────────────────────────────

  const getEntityIcon = (type: SearchEntityType, metadata: SearchResultItem['metadata']) => {
    switch (type) {
      case 'project':
        return <FolderGit2 className="h-4 w-4 text-accent-blue" />
      case 'task':
        return <CheckCircle2 className="h-4 w-4 text-accent-green" />
      case 'session':
        return <Timer className="h-4 w-4 text-accent-purple" />
      case 'note':
        return <FileText className="h-4 w-4 text-accent-amber" />
      case 'resource': {
        const resType = metadata.resourceType
        if (resType === 'snippet') return <Code className="h-4 w-4 text-accent-purple" />
        if (resType === 'file') return <FileCode className="h-4 w-4 text-accent-green" />
        return <Globe className="h-4 w-4 text-accent-blue" />
      }
    }
  }

  const getIconWrapperClass = (type: SearchEntityType) => {
    switch (type) {
      case 'project':
        return 'bg-accent-blue/10 border-accent-blue/20'
      case 'task':
        return 'bg-accent-green/10 border-accent-green/20'
      case 'session':
        return 'bg-accent-purple/10 border-accent-purple/20'
      case 'note':
        return 'bg-accent-amber/10 border-accent-amber/20'
      case 'resource':
        return 'bg-accent-blue/10 border-accent-blue/20'
    }
  }

  // Filter pills data
  const filterPills: Array<{ key: SearchFilterType; label: string; count: number }> = [
    { key: 'all', label: tx('All'), count: counts.all },
    { key: 'projects', label: tx('Projects'), count: counts.projects },
    { key: 'tasks', label: tx('Tasks'), count: counts.tasks },
    { key: 'sessions', label: tx('Sessions'), count: counts.sessions },
    { key: 'notes', label: tx('Notes'), count: counts.notes },
    { key: 'resources', label: tx('Resources'), count: counts.resources },
  ]

  // Group search results by entity type if filter is 'all'
  const groupedResults = React.useMemo(() => {
    if (activeFilter !== 'all') {
      const titles: Record<Exclude<SearchFilterType, 'all'>, string> = {
        projects: tx('Projects'),
        tasks: tx('Tasks'),
        sessions: tx('Sessions'),
        notes: tx('Notes'),
        resources: tx('Resources'),
      }
      return [{ type: activeFilter, title: titles[activeFilter], items: searchResults }]
    }

    const groups: Array<{ type: SearchEntityType; title: string; items: SearchResultItem[] }> = []
    const projects = searchResults.filter((r) => r.type === 'project')
    const tasks = searchResults.filter((r) => r.type === 'task')
    const sessions = searchResults.filter((r) => r.type === 'session')
    const notes = searchResults.filter((r) => r.type === 'note')
    const resources = searchResults.filter((r) => r.type === 'resource')

    if (projects.length > 0) groups.push({ type: 'project', title: tx('Projects'), items: projects })
    if (tasks.length > 0) groups.push({ type: 'task', title: tx('Tasks'), items: tasks })
    if (sessions.length > 0) groups.push({ type: 'session', title: tx('Work Sessions'), items: sessions })
    if (notes.length > 0) groups.push({ type: 'note', title: tx('Notes'), items: notes })
    if (resources.length > 0) groups.push({ type: 'resource', title: tx('Resources'), items: resources })

    return groups
  }, [activeFilter, searchResults, tx])

  // Track global index map to map rendered items to navigableItems indices
  let globalItemIndex = 0

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <DialogPrimitive.Portal>
        {/* Backdrop with Linear dark blur */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12%] -translate-x-1/2 w-[92vw] max-w-2xl bg-bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[76vh] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">
            {tx("ALTERA Command Palette")}</DialogPrimitive.Title>

          {/* Top Search Input Bar */}
          <div className="flex items-center gap-3 px-4 h-13 border-b border-border bg-bg-base/40 shrink-0">
            <Search className="h-4 w-4 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              id="command-palette-input"
              type="text"
              role="combobox"
              aria-label={t('header.search')}
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls="command-palette-results"
              aria-activedescendant={activeDescendantId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={tx("Search projects, tasks, notes, sessions, or type > for commands...")}
              className="flex-1 bg-transparent border-0 outline-none text-sm text-text-primary placeholder:text-text-muted focus:ring-0"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setSelectedIndex(0)
                }}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                title={tx("Clear query")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-elevated border border-border-subtle text-text-muted">
              ESC
            </kbd>
          </div>

          {/* Type Filter Pills Row (hidden when in pure > command mode) */}
          {!isCommandMode && (
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-subtle/80 bg-bg-surface/50 overflow-x-auto shrink-0 scrollbar-none">
              {filterPills.map((pill) => {
                const isActive = activeFilter === pill.key
                return (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => {
                      setActiveFilter(pill.key)
                      setSelectedIndex(0)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 border',
                      isActive
                        ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30 shadow-sm'
                        : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated border-transparent'
                    )}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={cn(
                        'text-[9px] px-1 rounded-full font-mono',
                        isActive
                          ? 'bg-accent-blue/20 text-accent-blue'
                          : 'bg-bg-elevated text-text-muted'
                      )}
                    >
                      {pill.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Results & Commands Area */}
          <div
            id="command-palette-results"
            ref={resultsContainerRef}
            className="flex-1 overflow-y-auto p-2 space-y-3 focus:outline-none"
            role="listbox"
            aria-label={tx("Search results and commands")}
            tabIndex={-1}
          >
            {/* Quick Commands Section (when in command mode, empty search, or matching commands exist) */}
            {matchingCommands.length > 0 && (isCommandMode || !query.trim() || activeFilter === 'all') && (
              <div className="space-y-1" role="group" aria-labelledby="quick-commands-label">
                <div id="quick-commands-label" className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {isCommandMode ? tx("Commands") : query.trim() ? 'Matching Commands' : 'Quick Commands'}
                </div>
                {matchingCommands.map((cmd) => {
                  const itemIndex = globalItemIndex++
                  const isSelected = selectedIndex === itemIndex
                  const Icon = cmd.icon

                  return (
                    <div
                      key={cmd.id}
                      id={commandOptionId(cmd.id)}
                      ref={(el) => {
                        itemRefs.current[itemIndex] = el
                      }}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => cmd.run()}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors border',
                        isSelected
                          ? 'bg-accent-blue/10 text-text-primary border-accent-blue/30 shadow-sm'
                          : 'text-text-secondary hover:bg-bg-elevated/70 border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-md border shrink-0',
                            cmd.iconColor === 'text-accent-blue' && 'bg-accent-blue/10 border-accent-blue/20',
                            cmd.iconColor === 'text-accent-green' && 'bg-accent-green/10 border-accent-green/20',
                            cmd.iconColor === 'text-accent-amber' && 'bg-accent-amber/10 border-accent-amber/20',
                            cmd.iconColor === 'text-accent-purple' && 'bg-accent-purple/10 border-accent-purple/20',
                            cmd.iconColor === 'text-text-muted' && 'bg-bg-elevated border-border'
                          )}
                        >
                          <Icon className={cn('h-3.5 w-3.5', cmd.iconColor)} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-text-primary truncate">
                            {cmd.title}
                          </span>
                          {cmd.description && (
                            <span className="text-[10px] text-text-muted truncate">
                              {cmd.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {cmd.shortcut && (
                          <span className="font-mono text-[9px] text-text-muted bg-bg-surface border border-border-subtle px-1.5 py-0.5 rounded">
                            {cmd.shortcut}
                          </span>
                        )}
                        <CornerDownLeft className="h-3 w-3 text-text-muted/60" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Entity Search Results */}
            {!isCommandMode && query.trim() && searchResults.length > 0 && (
              <div className="space-y-3">
                {groupedResults.map((group) => (
                  <div key={group.title} className="space-y-1" role="group" aria-labelledby={`results-group-${group.type}`}>
                    <div id={`results-group-${group.type}`} className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      <span>{group.title}</span>
                      <span className="font-mono text-[9px]">{group.items.length}</span>
                    </div>

                    {group.items.map((item) => {
                      const itemIndex = globalItemIndex++
                      const isSelected = selectedIndex === itemIndex

                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          id={resultOptionId(item)}
                          ref={(el) => {
                            itemRefs.current[itemIndex] = el
                          }}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectResult(item)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={cn(
                            'flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg text-xs cursor-pointer transition-colors border',
                            isSelected
                              ? 'bg-accent-blue/10 text-text-primary border-accent-blue/30 shadow-sm'
                              : 'text-text-secondary hover:bg-bg-elevated/70 border-transparent'
                          )}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            {/* Entity Icon Badge */}
                            <div
                              className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-md border shrink-0 mt-0.5',
                                getIconWrapperClass(item.type)
                              )}
                            >
                              {getEntityIcon(item.type, item.metadata)}
                            </div>

                            {/* Content Details */}
                            <div className="flex flex-col min-w-0 flex-1">
                              {/* Top Line: Identifier, Title, Status */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {item.identifier && (
                                  <span className="font-mono text-[10px] font-semibold text-accent-blue bg-accent-blue/10 border border-accent-blue/20 px-1 py-0.2 rounded shrink-0">
                                    {item.identifier}
                                  </span>
                                )}

                                <span className="font-medium text-text-primary truncate">
                                  {highlightMatches(item.title, query).map((part, idx) =>
                                    part.isMatch ? (
                                      <mark
                                        key={idx}
                                        className="bg-accent-blue/30 text-accent-blue font-semibold px-0.5 rounded"
                                      >
                                        {part.text}
                                      </mark>
                                    ) : (
                                      <span key={idx}>{part.text}</span>
                                    )
                                  )}
                                </span>

                                {/* Project Status Badge */}
                                {item.type === 'project' && item.metadata.status && (
                                  <span className="text-[9px] uppercase tracking-wider font-semibold text-text-muted bg-bg-elevated px-1.5 py-0.2 rounded border border-border-subtle shrink-0">
                                    {tx(item.metadata.status.replace(/_/g, ' ').replace(/\b[a-z]/g, character => character.toUpperCase()))}
                                  </span>
                                )}

                                {/* Task Priority Badge */}
                                {item.type === 'task' && item.metadata.priority && (
                                  <span
                                    className={cn(
                                      'text-[9px] font-medium px-1.5 py-0.2 rounded border shrink-0',
                                      item.metadata.priority === 'urgent' &&
                                        'bg-accent-red/15 text-accent-red border-accent-red/30',
                                      item.metadata.priority === 'high' &&
                                        'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
                                      item.metadata.priority === 'medium' &&
                                        'bg-accent-blue/15 text-accent-blue border-accent-blue/30',
                                      (item.metadata.priority === 'low' ||
                                        item.metadata.priority === 'none') &&
                                        'bg-bg-elevated text-text-muted border-border-subtle'
                                    )}
                                  >
                                    {tx(item.metadata.priority.charAt(0).toUpperCase() + item.metadata.priority.slice(1))}
                                  </span>
                                )}

                                {/* Favorite indicator */}
                                {item.metadata.isFavorite && (
                                  <Star className="h-3 w-3 text-accent-amber fill-accent-amber shrink-0" />
                                )}
                              </div>

                              {/* Second Line: Subtitle or Snippet */}
                              {item.snippet ? (
                                <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5 leading-relaxed">
                                  {highlightMatches(item.snippet, query).map((part, idx) =>
                                    part.isMatch ? (
                                      <mark
                                        key={idx}
                                        className="bg-accent-blue/25 text-accent-blue font-medium px-0.5 rounded"
                                      >
                                        {part.text}
                                      </mark>
                                    ) : (
                                      <span key={idx}>{part.text}</span>
                                    )
                                  )}
                                </p>
                              ) : item.subtitle ? (
                                <span className="text-[10px] text-text-muted truncate mt-0.5">
                                  {item.subtitle}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Right Side: Meta (Duration, Date, Enter hint) */}
                          <div className="flex items-center gap-2 shrink-0 self-center">
                            {item.type === 'session' && item.metadata.durationMs !== undefined && (
                              <span className="font-mono text-[10px] text-accent-purple bg-accent-purple/10 px-1.5 py-0.5 rounded border border-accent-purple/20">
                                {formatDuration(item.metadata.durationMs)}
                              </span>
                            )}
                            {item.metadata.date && (
                              <span className="text-[10px] text-text-muted/70">
                                {formatDate(item.metadata.date, i18n.language)}
                              </span>
                            )}
                            <CornerDownLeft className="h-3 w-3 text-text-muted/40" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Empty State when no results match query */}
            {query.trim() &&
              navigableItems.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-border-subtle rounded-lg bg-bg-base/30 my-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-elevated border border-border text-text-muted mb-3">
                    <Search className="h-5 w-5 stroke-[1.5]" />
                  </div>
                  <h3 className="text-xs font-semibold text-text-primary mb-1">
                    {tx("No results found for “")}{query}&rdquo;
                  </h3>
                  <p className="text-[11px] text-text-muted max-w-sm mb-4 leading-relaxed">
                    {tx("No items matched across")} {activeFilter === 'all' ? tx('any entity type') : activeFilter}{tx(". Try searching with different keywords or switch the filter tab.")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setActiveFilter('all')
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-bg-surface hover:bg-bg-elevated border border-border text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <span>{tx("Clear Search")}</span>
                  </button>
                </div>
              )}
          </div>

          {/* Footer Bar with Keyboard Shortcut Hints */}
          <div className="border-t border-border-subtle bg-bg-base/60 px-4 py-2 flex items-center justify-between text-[11px] text-text-muted shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono text-[9px] bg-bg-surface px-1 py-0.5 rounded border border-border-subtle">
                  ↑↓
                </kbd>
                <span>{tx("Navigate")}</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono text-[9px] bg-bg-surface px-1 py-0.5 rounded border border-border-subtle">
                  ↵
                </kbd>
                <span>{tx("Select")}</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono text-[9px] bg-bg-surface px-1 py-0.5 rounded border border-border-subtle">
                  esc
                </kbd>
                <span>{tx("Close")}</span>
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-text-muted/80">
              <span>{tx("Type")}</span>
              <kbd className="font-mono text-[9px] bg-bg-surface px-1 py-0.5 rounded border border-border-subtle font-semibold text-accent-blue">
                &gt;
              </kbd>
              <span>{tx("for commands")}</span>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
