import * as React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import {
  Globe,
  Paperclip,
  Plus,
  Search,
  Clock,
  Star,
  Archive,
  FileText,
  Layers,
  ChevronDown,
  Menu,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { NoteDetail, CreateNoteDialog } from '@/components/knowledge/notes'
import { ResourceList, CreateResourceDialog } from '@/components/knowledge/resources'
import { AttachmentManager } from '@/components/knowledge/attachments'
import { TagManagerDialog } from '@/components/knowledge/tags'
import { LinkedEntities, BacklinksPanel } from '@/components/knowledge/relationships'
import { useKnowledgeCounts, useNotesQuery } from '@/hooks/useKnowledge'
import { useProjects } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'
import { resolveKnowledgeHubNoteSelection, withKnowledgeHubNote } from './knowledgeHubSelection'
import { getKnowledgeHubAction } from '@/lib/appRoutes'

const EMPTY_PROJECTS: Project[] = []

export function KnowledgeHub() {
  const { t, tx } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const requestedTab = searchParams.get('tab')
  const currentTab = requestedTab === 'resources' || requestedTab === 'attachments'
    ? requestedTab
    : 'notes'
  const currentProjectId = searchParams.get('project') || undefined
  const currentNoteId = searchParams.get('note') || undefined
  const currentResourceId = searchParams.get('resource') || undefined
  const currentFilter = searchParams.get('filter') || 'all'

  const counts = useKnowledgeCounts(currentProjectId)
  const projects = useProjects() ?? EMPTY_PROJECTS
  const [hubSearch, setHubSearch] = React.useState('')
  const allNotes = useNotesQuery()
  const noteSearch = hubSearch.trim().toLowerCase()

  const selectedNoteId = currentNoteId
  const hasResolvedInitialSelection = React.useRef(false)
  const [isCreateNoteOpen, setIsCreateNoteOpen] = React.useState(false)
  const [isCreateResourceOpen, setIsCreateResourceOpen] = React.useState(false)
  const [isTagManagerOpen, setIsTagManagerOpen] = React.useState(false)
  const [isMobileHubNavigationOpen, setIsMobileHubNavigationOpen] = React.useState(false)
  const handledActionLocationRef = React.useRef<string | null>(null)

  const routeAction = getKnowledgeHubAction(searchParams)

  // Route actions persist through page mounts; consume them once and remove the
  // intent from history so StrictMode and subsequent renders cannot reopen it.
  React.useEffect(() => {
    if (!routeAction) return
    const actionKey = `${location.key}:${routeAction}`
    if (handledActionLocationRef.current === actionKey) return
    handledActionLocationRef.current = actionKey

    const next = new URLSearchParams(searchParams)
    next.set('tab', routeAction === 'create-note' ? 'notes' : 'resources')
    next.delete('action')
    setSearchParams(next, { replace: true })
    if (routeAction === 'create-note') setIsCreateNoteOpen(true)
    else setIsCreateResourceOpen(true)
  }, [location.key, routeAction, searchParams, setSearchParams])

  const handleSelectNote = React.useCallback((id: string | undefined, replace = false) => {
    const next = withKnowledgeHubNote(searchParams, id)
    next.set('tab', 'notes')
    next.delete('resource')
    setSearchParams(next, { replace })
  }, [searchParams, setSearchParams])

  const clearSelectedResource = React.useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('resource')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // The URL owns note selection. Wait for the live query before validating or selecting.
  React.useEffect(() => {
    if (currentTab !== 'notes') return

    const decision = resolveKnowledgeHubNoteSelection({
      notes: allNotes,
      noteId: currentNoteId,
      projectId: currentProjectId,
      search: noteSearch,
      initialSelectionResolved: hasResolvedInitialSelection.current,
    })

    if (decision.action === 'wait') return
    hasResolvedInitialSelection.current = decision.initialSelectionResolved
    if (decision.action === 'select') handleSelectNote(decision.noteId, true)
  }, [allNotes, currentTab, currentNoteId, currentProjectId, noteSearch, handleSelectNote])

  const setTab = (tab: 'notes' | 'resources' | 'attachments') => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    if (tab !== 'notes') next.delete('note')
    if (tab !== 'resources') next.delete('resource')
    setSearchParams(next)
  }

  const handleFilterClick = (filter: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('filter', filter)
    setSearchParams(next)
  }

  const handleProjectFilter = (projId: string | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (projId) {
      next.set('project', projId)
    } else {
      next.delete('project')
    }
    setSearchParams(next)
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-bg-base">
      {/* ─── Column 2: "Центр знаний" Navigation Rail (Stitch Screenshot 2) ─── */}
      {isMobileHubNavigationOpen && (
        <button
          type="button"
          aria-label={tx('Close')}
          className="absolute inset-0 z-30 cursor-default bg-black/50 xl:hidden"
          onClick={() => setIsMobileHubNavigationOpen(false)}
        />
      )}
      <aside
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) setIsMobileHubNavigationOpen(false)
        }}
        className={cn(
          'absolute inset-y-0 left-0 z-40 w-[min(18rem,calc(100vw-2.5rem))] border-r border-border-subtle bg-bg-surface flex-col justify-between shrink-0 select-none xl:relative xl:z-auto xl:flex xl:w-72 xl:shadow-none',
          isMobileHubNavigationOpen ? 'flex shadow-2xl' : 'hidden'
        )}
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header Title */}
          <div className="p-4 border-b border-border-subtle/50">
            <h2 className="font-serif text-lg font-normal text-text-primary tracking-tight">
              {t('knowledge.hubTitle')}
            </h2>

            {/* Hub Search Input */}
            <div className="mt-3 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                aria-label={t('knowledge.searchPlaceholder')}
                placeholder={t('knowledge.searchPlaceholder')}
                className="w-full h-8 pl-8 pr-3 rounded-md border border-border-subtle bg-bg-base/70 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-olive/60 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-5">
            {/* 1. НАВИГАЦИЯ section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-section text-text-muted">
                  {t('knowledge.navigation')}
                </span>
                <ChevronDown className="h-3 w-3 text-text-muted/60" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setTab('notes')
                  handleFilterClick('all')
                }}
                className={cn(
                  'w-full flex items-center justify-between h-8 px-2.5 rounded-md text-xs font-medium transition-colors text-left',
                  currentTab === 'notes' && currentFilter === 'all'
                    ? 'bg-bg-elevated text-text-primary border border-border/60'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-4 w-4 items-center justify-center rounded bg-accent-olive/20 text-accent-olive">
                    <Layers className="h-2.5 w-2.5" />
                  </div>
                  <span>{t('knowledge.allKnowledge')}</span>
                </div>
                <span className="font-mono text-[10px] text-text-muted">
                  {counts.notes}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('notes')
                  handleFilterClick('recent')
                }}
                className={cn(
                  'w-full flex items-center justify-between h-8 px-2.5 rounded-md text-xs font-medium transition-colors text-left',
                  currentTab === 'notes' && currentFilter === 'recent'
                    ? 'bg-bg-elevated text-text-primary border border-border/60'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                )}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-text-muted" />
                  <span>{t('knowledge.recent')}</span>
                </div>
                <span className="font-mono text-[10px] text-text-muted">
                  {Math.min(counts.notes, 12)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('notes')
                  handleFilterClick('favorites')
                }}
                className={cn(
                  'w-full flex items-center justify-between h-8 px-2.5 rounded-md text-xs font-medium transition-colors text-left',
                  currentTab === 'notes' && currentFilter === 'favorites'
                    ? 'bg-bg-elevated text-text-primary border border-border/60'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                )}
              >
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-accent-amber" />
                  <span>{t('knowledge.favorites')}</span>
                </div>
                <span className="font-mono text-[10px] text-accent-amber">
                  {counts.favorites}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('notes')
                  handleFilterClick('trash')
                }}
                className={cn(
                  'w-full flex items-center justify-between h-8 px-2.5 rounded-md text-xs font-medium transition-colors text-left',
                  currentTab === 'notes' && currentFilter === 'trash'
                    ? 'bg-bg-elevated text-text-primary border border-border/60'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                )}
              >
                <div className="flex items-center gap-2">
                  <Archive className="h-3.5 w-3.5 text-text-muted" />
                  <span>{t('knowledge.archive')}</span>
                </div>
                <span className="font-mono text-[10px] text-text-muted">
                  {counts.trash || 0}
                </span>
              </button>
            </div>

            {/* 2. ПРОЕКТЫ section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-section text-text-muted">
                  {t('knowledge.projects')}
                </span>
                <ChevronDown className="h-3 w-3 text-text-muted/60" />
              </div>

              {projects.map((proj, idx) => {
                const isSelected = currentProjectId === proj.id
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleProjectFilter(isSelected ? undefined : proj.id)}
                    className={cn(
                      'w-full flex items-center justify-between h-7.5 px-2.5 rounded-md text-xs transition-colors text-left',
                      isSelected
                        ? 'bg-bg-elevated text-text-primary font-medium border border-border/50'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          idx === 0 ? 'bg-accent-olive' : 'bg-text-muted'
                        )}
                      />
                      <span className="truncate">{proj.name}</span>
                    </div>
                    <span className="font-mono text-[9px] text-text-muted shrink-0 pl-1">
                      {proj.identifier}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Secondary Tabs (Resources & Vault) */}
            <div className="pt-2 border-t border-border-subtle/50 space-y-1">
              <button
                type="button"
                onClick={() => setTab('resources')}
                className={cn(
                  'w-full flex items-center justify-between h-7.5 px-2.5 rounded-md text-xs transition-colors text-left',
                  currentTab === 'resources'
                    ? 'bg-bg-elevated text-text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                )}
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-text-muted" />
                  <span>{t('knowledge.tabs.resources')}</span>
                </div>
                <span className="font-mono text-[10px] text-text-muted">
                  {counts.resources}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTab('attachments')}
                className={cn(
                  'w-full flex items-center justify-between h-7.5 px-2.5 rounded-md text-xs transition-colors text-left',
                  currentTab === 'attachments'
                    ? 'bg-bg-elevated text-text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/60'
                )}
              >
                <div className="flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-text-muted" />
                  <span>{t('knowledge.tabs.attachments')}</span>
                </div>
              </button>
            </div>
          </div>

          {/* Bottom Action Button */}
          <div className="p-3 border-t border-border-subtle bg-bg-surface">
            {currentTab === 'notes' ? (
              <Button
                size="sm"
                variant="olive"
                onClick={() => setIsCreateNoteOpen(true)}
                className="w-full gap-1.5 h-8.5 text-xs shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('knowledge.newNote')}</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="olive"
                onClick={() => setIsCreateResourceOpen(true)}
                className="w-full gap-1.5 h-8.5 text-xs shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('knowledge.newResource')}</span>
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Column 3: Main Reading & Document Content Area ─── */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-bg-base">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-surface px-3 xl:hidden">
          <button
            type="button"
            aria-expanded={isMobileHubNavigationOpen}
            onClick={() => setIsMobileHubNavigationOpen(true)}
            className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-olive"
          >
            <Menu aria-hidden="true" className="h-4 w-4" />
            <span>{t('knowledge.hubTitle')}</span>
          </button>
          <span className="truncate text-xs text-text-muted">
            {currentTab === 'notes' ? t('knowledge.tabs.notes') : t(`knowledge.tabs.${currentTab}`)}
          </span>
        </div>
        {currentTab === 'notes' && (
          <div className="flex-1 flex overflow-hidden">
            {selectedNoteId ? (
              <div className="flex-1 flex flex-col h-full overflow-y-auto">
                <NoteDetail
                  noteId={selectedNoteId}
                  onBack={() => handleSelectNote(undefined)}
                  className="flex-1"
                />

                {/* Sub-panels: Bidirectional Relationships & Note Attachments */}
                <div className="border-t border-border-subtle p-6 max-w-4xl mx-auto w-full space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LinkedEntities entityType="note" entityId={selectedNoteId} />
                    <BacklinksPanel entityType="note" entityId={selectedNoteId} />
                  </div>

                  <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface/50">
                    <AttachmentManager title={t('knowledge.tabs.attachments')} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-surface border border-border text-accent-olive">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif text-lg text-text-primary">
                    {t('knowledge.noNoteSelected')}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {t('knowledge.noNoteSelectedDesc')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="olive"
                  onClick={() => setIsCreateNoteOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('knowledge.createNoteBtn')}</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {currentTab === 'resources' && (
          <div className="p-8 max-w-5xl mx-auto w-full overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
              <div>
                <h2 className="font-serif text-2xl text-text-primary">
                  {t('knowledge.tabs.resources')}
                </h2>
                <p className="text-xs text-text-secondary mt-1">
                  {tx("Web references, code snippets and bookmarks.")}</p>
              </div>
              <Button
                size="sm"
                variant="olive"
                onClick={() => setIsCreateResourceOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t('knowledge.newResource')}</span>
              </Button>
            </div>
            <ResourceList
              projectId={currentProjectId}
              selectedResourceId={currentResourceId}
              onClearSelectedResource={clearSelectedResource}
            />
          </div>
        )}

        {currentTab === 'attachments' && (
          <div className="p-8 max-w-5xl mx-auto w-full overflow-y-auto space-y-6">
            <div className="pb-4 border-b border-border-subtle space-y-1">
              <h2 className="font-serif text-2xl text-text-primary">
                {t('knowledge.attachmentsVault')}
              </h2>
              <p className="text-xs text-text-secondary">
                {t('knowledge.attachmentsVaultDesc')}
              </p>
            </div>
            <AttachmentManager title={t('knowledge.attachmentsVault')} />
          </div>
        )}
      </main>

      {/* ─── Global Knowledge Dialogs ─── */}
      <CreateNoteDialog
        open={isCreateNoteOpen}
        onOpenChange={setIsCreateNoteOpen}
        initialProjectId={currentProjectId}
        onCreated={(newNote) => handleSelectNote(newNote.id)}
      />

      <CreateResourceDialog
        open={isCreateResourceOpen}
        onOpenChange={setIsCreateResourceOpen}
        initialProjectId={currentProjectId}
      />

      <TagManagerDialog
        open={isTagManagerOpen}
        onOpenChange={setIsTagManagerOpen}
      />
    </div>
  )
}

export default KnowledgeHub
