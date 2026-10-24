import * as React from 'react'
import {
  RotateCcw,
  Trash2,
  Database,
  CheckCircle,
  Info,
  Palette,
} from 'lucide-react'
import { clearAllData } from '@/db/db'
import { seedDatabase } from '@/db/seed'
import { useProjects } from '@/hooks/useProjects'
import { useAllTasks } from '@/hooks/useTasks'
import { useRecentActivity } from '@/hooks/useActivity'
import { useAllSessions } from '@/hooks/useSessions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
// Resolved at build time — no runtime network call needed
import appPkg from '../../package.json'

export function Settings() {
  const projects = useProjects() || []
  const tasks = useAllTasks() || []
  const activities = useRecentActivity(100) || []
  const sessions = useAllSessions()

  const [isResetting, setIsResetting] = React.useState(false)
  const [resetSuccess, setResetSuccess] = React.useState(false)
  const [showResetDialog, setShowResetDialog] = React.useState(false)
  const [showWipeDialog, setShowWipeDialog] = React.useState(false)

  const handleResetDemoData = async () => {
    setIsResetting(true)
    try {
      await seedDatabase()
      setShowResetDialog(false)
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 3000)
    } finally {
      setIsResetting(false)
    }
  }

  const handleWipeAll = async () => {
    setIsResetting(true)
    try {
      await clearAllData()
      setShowWipeDialog(false)
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 3000)
    } finally {
      setIsResetting(false)
    }
  }

  const themeVariables = [
    { label: '--bg-base', value: '#0d0d0f' },
    { label: '--bg-surface', value: '#111113' },
    { label: '--bg-elevated', value: '#18181b' },
    { label: '--bg-hover', value: '#1e1e21' },
    { label: '--border', value: '#2a2a2d' },
    { label: '--border-subtle', value: '#222225' },
    { label: '--accent-blue', value: '#3b82f6' },
    { label: '--accent-purple', value: '#8b5cf6' },
    { label: '--accent-green', value: '#22c55e' },
    { label: '--accent-amber', value: '#f59e0b' },
    { label: '--accent-red', value: '#ef4444' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-base font-semibold text-text-primary">Settings</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Configure local workspace storage, data backups, and environment preferences.
        </p>
      </div>

      {resetSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-accent-green/30 bg-accent-green/10 text-accent-green text-xs font-medium animate-in fade-in">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>IndexedDB data store updated successfully!</span>
        </div>
      )}

      {/* SECTION 1: Local Storage Management */}
      <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border-subtle bg-bg-elevated/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-accent-blue" />
            <h2 className="text-xs font-semibold text-text-primary">
              IndexedDB Storage Engine
            </h2>
          </div>
          <span className="font-mono text-[10px] text-accent-green px-2 py-0.5 rounded-full bg-accent-green/10 border border-accent-green/20">
            Connected: AlteraDB (Dexie v4)
          </span>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            ALTERA runs strictly client-side. All project definitions, task checklists, and activity audit logs are kept in your browser's local IndexedDB engine. No external accounts or cloud sync required.
          </p>

          {/* Database Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-md bg-bg-base border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-muted">
                Stored Projects
              </span>
              <div className="font-mono text-lg font-bold text-text-primary mt-0.5">
                {projects.length}
              </div>
            </div>

            <div className="p-3 rounded-md bg-bg-base border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-muted">
                Total Tasks
              </span>
              <div className="font-mono text-lg font-bold text-text-primary mt-0.5">
                {tasks.length}
              </div>
            </div>

            <div className="p-3 rounded-md bg-bg-base border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-muted">
                Audit Events
              </span>
              <div className="font-mono text-lg font-bold text-text-primary mt-0.5">
                {activities.length}
              </div>
            </div>

            <div className="p-3 rounded-md bg-bg-base border border-border-subtle">
              <span className="text-[10px] uppercase font-semibold text-text-muted">
                Work Sessions
              </span>
              <div className="font-mono text-lg font-bold text-text-primary mt-0.5">
                {sessions.length}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-border-subtle">
            <Button
              variant="secondary"
              onClick={() => setShowResetDialog(true)}
              disabled={isResetting}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5 text-accent-blue" />
              <span>Reset to Demo Data</span>
            </Button>

            <Button
              variant="danger"
              onClick={() => setShowWipeDialog(true)}
              disabled={isResetting}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Wipe All Data</span>
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Design System & Color Palette */}
      <div className="rounded-lg border border-border bg-bg-surface overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border-subtle bg-bg-elevated/40 flex items-center gap-2">
          <Palette className="h-4 w-4 text-accent-purple" />
          <h2 className="text-xs font-semibold text-text-primary">
            Linear-Inspired Dark Design System
          </h2>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            The ALTERA interface uses a customized dark-first palette with compact 36px/40px row heights, high-contrast typography, and monospace identifiers.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {themeVariables.map((tok) => (
              <div
                key={tok.label}
                className="flex items-center gap-2 p-2 rounded border border-border-subtle bg-bg-base"
              >
                <div
                  className="h-4 w-4 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: tok.value }}
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono font-medium text-text-primary truncate">
                    {tok.label}
                  </div>
                  <div className="text-[9px] font-mono text-text-muted">
                    {tok.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3: System Information */}
      <div className="rounded-lg border border-border bg-bg-surface p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          <Info className="h-4 w-4 text-text-secondary" />
          <span>About ALTERA</span>
        </div>
        <div className="text-xs text-text-secondary space-y-1.5 leading-relaxed">
          <p>
            ALTERA is built on Vite, React {React.version}, TypeScript, Tailwind CSS, Radix UI primitives, and Dexie.js for IndexedDB.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-text-muted pt-2 font-mono">
            <span>Version: {appPkg.version}</span>
            <span>Architecture: Local-First</span>
            <span>Sync: Offline-Capable</span>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset to Demo Data</DialogTitle>
            <DialogDescription>
              This will overwrite all existing local records with the default set of 7 realistic projects (ALTERA Core Engine, Marketing Site Redesign, Onboarding Flow, etc.), along with 30+ tasks and initial activity events.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetDemoData} disabled={isResetting}>
              {isResetting ? 'Resetting...' : 'Confirm Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wipe Confirmation Dialog */}
      <Dialog open={showWipeDialog} onOpenChange={setShowWipeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Wipe All Data</DialogTitle>
            <DialogDescription>
              Are you sure? This will permanently delete all projects, tasks, and history from IndexedDB. Your workspace will be completely empty.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowWipeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleWipeAll}
              disabled={isResetting}
            >
              {isResetting ? 'Wiping...' : 'Yes, Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
