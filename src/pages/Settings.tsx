import * as React from 'react'
import {
  RotateCcw,
  Trash2,
  Database,
  CheckCircle,
  AlertCircle,
  Info,
  Palette,
  Download,
  Upload,
  FileJson,
  Languages,
  Check,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, clearAllData } from '@/db/db'
import { validateBackup, MAX_BACKUP_BYTES, isBackupSizeAllowed, type BackupV3 } from '@/db/backupValidation'
import { importBackup } from '@/db/backupImport'
import { exportBackupPreferences } from '@/db/backupPreferences'
import { clearNoteDrafts } from '@/components/knowledge/editor/draftRecovery'
import { inspectDatabaseIntegrity, type IntegrityIssue } from '@/db/integrity'
import { seedDatabase } from '@/db/seed'
import { useProjects } from '@/hooks/useProjects'
import { useAllTasks } from '@/hooks/useTasks'
import { useAllSessions } from '@/hooks/useSessions'
import { useKnowledgeCounts, useTags } from '@/hooks/useKnowledge'
import { Button } from '@/components/ui/button'
import { PersonalizationSettings } from '@/components/settings/PersonalizationSettings'
import { WorkflowTemplateSettings } from '@/components/settings/WorkflowTemplateSettings'
import { useTranslation } from '@/i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
// Resolved at build time — no runtime network call needed
import appPkg from '../../package.json'

interface BackupNotification {
  type: 'success' | 'error'
  message: string
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function Settings() {
  const { t, tx, i18n } = useTranslation()
  const projects = useProjects() || []
  const tasks = useAllTasks() || []
  const sessions = useAllSessions()
  const knowledgeCounts = useKnowledgeCounts()
  const tags = useTags()

  const attachmentsCount = useLiveQuery(() => db.attachments.count()) ?? 0
  const entityLinksCount = useLiveQuery(() => db.entityLinks.count()) ?? 0
  const calendarBlocksCount = useLiveQuery(() => db.scheduledWorkBlocks.count()) ?? 0

  const [isResetting, setIsResetting] = React.useState(false)
  const [resetSuccess, setResetSuccess] = React.useState(false)
  const [showResetDialog, setShowResetDialog] = React.useState(false)
  const [showWipeDialog, setShowWipeDialog] = React.useState(false)

  // Backup & Restore states
  const [isExporting, setIsExporting] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const [showImportDialog, setShowImportDialog] = React.useState(false)
  const [pendingImport, setPendingImport] = React.useState<BackupV3 | null>(null)
  const [backupNotification, setBackupNotification] = React.useState<BackupNotification | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [isCheckingIntegrity, setIsCheckingIntegrity] = React.useState(false)
  const [integrityResult, setIntegrityResult] = React.useState<{ checkedAt: Date; issues: IntegrityIssue[] } | null>(null)
  const [integrityError, setIntegrityError] = React.useState(false)

  React.useEffect(() => {
    if (backupNotification) {
      const timer = setTimeout(() => setBackupNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [backupNotification])

  const handleResetDemoData = async () => {
    setIsResetting(true)
    try {
      await seedDatabase()
      clearNoteDrafts()
      setShowResetDialog(false)
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 3000)
    } catch {
      setBackupNotification({ type: 'error', message: t('settings.reset.seedError') })
    } finally {
      setIsResetting(false)
    }
  }

  const handleWipeAll = async () => {
    setIsResetting(true)
    try {
      await clearAllData()
      clearNoteDrafts()
      setShowWipeDialog(false)
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 3000)
    } catch {
      setBackupNotification({ type: 'error', message: t('settings.reset.wipeError') })
    } finally {
      setIsResetting(false)
    }
  }

  const handleExportBackup = async () => {
    setIsExporting(true)
    try {
      const [
        projectsData,
        tasksData,
        activitiesData,
        sessionsData,
        notesData,
        resourcesData,
        attachmentsData,
        tagsData,
        tagAssignmentsData,
        entityLinksData,
        scheduledWorkBlocksData,
        workflowTemplatesData,
      ] = await Promise.all([
        db.projects.toArray(),
        db.tasks.toArray(),
        db.activities.toArray(),
        db.sessions.toArray(),
        db.notes.toArray(),
        db.resources.toArray(),
        db.attachments.toArray(),
        db.tags.toArray(),
        db.tagAssignments.toArray(),
        db.entityLinks.toArray(),
        db.scheduledWorkBlocks.toArray(),
        db.workflowTemplates.toArray(),
      ])

      const serializedAttachments = await Promise.all(
        attachmentsData.map(async (att) => {
          let blobDataUrl: string | undefined
          if (att.blob instanceof Blob) {
            blobDataUrl = await blobToDataUrl(att.blob)
          }
          return {
            id: att.id,
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.size,
            createdAt: att.createdAt,
            blobDataUrl,
          }
        })
      )

      const backupData = {
        app: 'ALTERA',
        schemaVersion: 3,
        exportedAt: new Date().toISOString(),
        preferences: exportBackupPreferences(),
        tables: {
          projects: projectsData,
          tasks: tasksData,
          activities: activitiesData,
          sessions: sessionsData,
          notes: notesData,
          resources: resourcesData,
          attachments: serializedAttachments,
          tags: tagsData,
          tagAssignments: tagAssignmentsData,
          entityLinks: entityLinksData,
          scheduledWorkBlocks: scheduledWorkBlocksData,
          workflowTemplates: workflowTemplatesData,
        },
      }

      const jsonStr = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      if (!isBackupSizeAllowed(blob.size)) {
        setBackupNotification({ type: 'error', message: t('settings.backup.exportTooLarge') })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `altera-backup-${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setBackupNotification({ type: 'success', message: t('settings.backup.exportSuccess') })
    } catch {
      console.error('Export failed')
      setBackupNotification({ type: 'error', message: t('settings.backup.exportError') })
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > MAX_BACKUP_BYTES) {
      setBackupNotification({ type: 'error', message: t('settings.backup.fileTooLarge') })
      return
    }

    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      setIsImporting(false)
      try {
        const parsed = JSON.parse(event.target?.result as string)
        if (
          !parsed ||
          parsed.app !== 'ALTERA' ||
          parsed.schemaVersion !== 3 ||
          !parsed.tables ||
          typeof parsed.tables !== 'object'
        ) {
          setBackupNotification({
            type: 'error',
            message: t('settings.backup.invalidFormat'),
          })
          return
        }

        setPendingImport(validateBackup(parsed))
        setShowImportDialog(true)
      } catch (error) {
        setBackupNotification({
          type: 'error',
          message: error instanceof SyntaxError
            ? t('settings.backup.invalidJson')
            : t('settings.backup.invalidData'),
        })
      }
    }
    reader.onerror = () => {
      setIsImporting(false)
      setBackupNotification({
        type: 'error',
        message: t('settings.backup.readError'),
      })
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = async () => {
    if (!pendingImport) return
    setIsImporting(true)
    try {
      const importResult = await importBackup(pendingImport)
      const { projects: projectsData, tasks: tasksData, notes: notesData } = pendingImport.tables

      setShowImportDialog(false)
      setPendingImport(null)
      setBackupNotification({
        type: 'success',
        message: importResult.preferencesRestored === false
          ? t('settings.backup.importPreferencesWarning')
          : t('settings.backup.importSuccess', {
            projects: projectsData.length,
            tasks: tasksData.length,
            notes: notesData.length,
          }),
      })
    } catch {
      console.error('Import failed')
      setBackupNotification({
        type: 'error',
        message: t('settings.backup.importError'),
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleIntegrityScan = async () => {
    setIsCheckingIntegrity(true)
    setIntegrityError(false)
    try {
      const issues = await inspectDatabaseIntegrity()
      setIntegrityResult({ checkedAt: new Date(), issues })
    } catch {
      setIntegrityError(true)
    } finally {
      setIsCheckingIntegrity(false)
    }
  }

  const themeVariables = [
    { label: '--bg-base', value: '#0e0e0d' },
    { label: '--bg-surface', value: '#171815' },
    { label: '--bg-elevated', value: '#1e201b' },
    { label: '--bg-hover', value: '#262821' },
    { label: '--border', value: '#2c2e28' },
    { label: '--border-subtle', value: '#242620' },
    { label: '--accent-olive', value: '#91a276' },
    { label: '--accent-sage', value: '#74865d' },
    { label: '--accent-light-olive', value: '#a3b899' },
    { label: '--accent-amber', value: '#d97706' },
    { label: '--accent-red', value: '#ef4444' },
  ]

  return (
    <div className="px-5 py-5 md:px-7 md:py-6 max-w-4xl mx-auto space-y-5">
      {/* Page Title */}
      <div className="pb-3 border-b border-border-subtle">
        <h1 className="font-serif text-2xl md:text-[28px] font-medium tracking-tight text-text-primary">
          {t('settings.title')}
        </h1>
        <p className="text-[13px] md:text-sm text-text-secondary mt-1 font-sans">
          {t('settings.subtitle')}
        </p>
      </div>

      {resetSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-[#8a9e6b]/30 bg-[#8a9e6b]/10 text-[#8a9e6b] text-xs font-medium animate-in fade-in">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{tx("IndexedDB data store updated successfully!")}</span>
        </div>
      )}

      {backupNotification && (
        <div
          className={cn(
            'flex items-center gap-2 p-3.5 rounded-xl border text-xs font-medium animate-in fade-in',
            backupNotification.type === 'success'
              ? 'border-[#8a9e6b]/30 bg-[#8a9e6b]/10 text-[#8a9e6b]'
              : 'border-red-500/30 bg-red-950/20 text-red-300'
          )}
        >
          {backupNotification.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{backupNotification.message}</span>
        </div>
      )}

      {/* SECTION 1: Interface Language Switcher */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-[#242420] bg-[#1a1a17]/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Languages className="h-4 w-4 text-[#8a9e6b]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#eceeed]">
              {t('settings.language.title')}
            </h2>
          </div>
          <span className="font-mono text-[10px] text-[#8a9e6b] px-2 py-0.5 rounded-full bg-[#8a9e6b]/10 border border-[#8a9e6b]/20 font-medium">
            {i18n.language === 'ru' ? tx("Русский") : tx("English")}
          </span>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#9ca3af] leading-relaxed">
            {t('settings.language.desc')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('ru')}
              className={cn(
                'flex items-center justify-between p-3.5 rounded-md border text-left transition-colors duration-150',
                i18n.language === 'ru'
                  ? 'border-[#8a9e6b] bg-[#8a9e6b]/10 ring-1 ring-[#8a9e6b]/20 shadow-sm'
                  : 'border-[#242420] bg-[#0e0e0d] hover:bg-[#1a1a17] hover:border-[#2e2e28]'
              )}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#eceeed]">{tx("Русский")}</span>
                  <span className="text-[10px] font-mono text-[#8a9e6b] px-1.5 py-0.2 rounded bg-[#8a9e6b]/15">
                    RU
                  </span>
                </div>
                <p className="text-xs text-[#9ca3af]">
                  {t('settings.language.ru')}
                </p>
              </div>
              {i18n.language === 'ru' && (
                <Check className="h-4 w-4 text-[#8a9e6b] shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={cn(
                'flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150',
                i18n.language === 'en'
                  ? 'border-[#8a9e6b] bg-[#8a9e6b]/10 ring-1 ring-[#8a9e6b]/20 shadow-sm'
                  : 'border-[#242420] bg-[#0e0e0d] hover:bg-[#1a1a17] hover:border-[#2e2e28]'
              )}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#eceeed]">{tx("English")}</span>
                  <span className="text-[10px] font-mono text-[#8a9e6b] px-1.5 py-0.2 rounded bg-[#8a9e6b]/15">
                    EN
                  </span>
                </div>
                <p className="text-xs text-[#9ca3af]">
                  {t('settings.language.en')}
                </p>
              </div>
              {i18n.language === 'en' && (
                <Check className="h-4 w-4 text-[#8a9e6b] shrink-0" />
              )}
            </button>
          </div>
        </div>
      </div>

      <PersonalizationSettings />
      <WorkflowTemplateSettings />

      {/* SECTION 2: Local Storage Management */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-[#242420] bg-[#1a1a17]/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database className="h-4 w-4 text-[#8a9e6b]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#eceeed]">
              {t('settings.storage.title')}
            </h2>
          </div>
          <span className="font-mono text-[10px] text-[#8a9e6b] px-2 py-0.5 rounded-full bg-[#8a9e6b]/10 border border-[#8a9e6b]/20 font-medium">
            {t('settings.storage.status', { version: db.verno })}
          </span>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#9ca3af] leading-relaxed font-sans">
            {t('settings.storage.desc')}
          </p>

          {/* Database Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.projects')}
              </span>
              <div className="font-mono text-xl font-bold text-[#eceeed] mt-1">
                {projects.length}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.tasks')}
              </span>
              <div className="font-mono text-xl font-bold text-[#eceeed] mt-1">
                {tasks.length}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.sessions')}
              </span>
              <div className="font-mono text-xl font-bold text-[#eceeed] mt-1">
                {sessions.length}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.notes')}
              </span>
              <div className="font-mono text-xl font-bold text-[#8a9e6b] mt-1">
                {knowledgeCounts.notes}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.resources')}
              </span>
              <div className="font-mono text-xl font-bold text-[#a3b899] mt-1">
                {knowledgeCounts.resources}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.attachments')}
              </span>
              <div className="font-mono text-xl font-bold text-[#8a9e6b] mt-1">
                {attachmentsCount}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.tags')}
              </span>
              <div className="font-mono text-xl font-bold text-amber-400 mt-1">
                {tags.length}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.links')}
              </span>
              <div className="font-mono text-xl font-bold text-[#8a9e6b] mt-1">
                {entityLinksCount}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0e0e0d] border border-[#242420]">
              <span className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                {t('settings.storage.calendarBlocks')}
              </span>
              <div className="font-mono text-xl font-bold text-[#8a9e6b] mt-1">
                {calendarBlocksCount}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-3 flex flex-wrap items-center gap-3 border-t border-[#242420]">
            <Button
              variant="secondary"
              onClick={() => setShowResetDialog(true)}
              disabled={isResetting}
              className="gap-1.5 bg-[#1a1a17] hover:bg-[#242420] text-[#eceeed] border-[#2e2e28]"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#8a9e6b]" />
              <span>{t('settings.reset.seedBtn')}</span>
            </Button>

            <Button
              variant="danger"
              onClick={() => setShowWipeDialog(true)}
              disabled={isResetting}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('settings.reset.wipeBtn')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION 3: JSON Workspace Backup & Restore */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-[#242420] bg-[#1a1a17]/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileJson className="h-4 w-4 text-[#8a9e6b]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#eceeed]">
              {t('settings.backup.title')}
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#6b7280] px-2 py-0.5 rounded bg-[#0e0e0d] border border-[#242420]">
            {tx("Local JSON Format")}</span>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#9ca3af] leading-relaxed">
            {t('settings.backup.desc')}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="olive"
              onClick={handleExportBackup}
              disabled={isExporting}
              className="gap-1.5 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExporting ? tx("Exporting...") : t('settings.backup.exportBtn')}</span>
            </Button>

            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="gap-1.5 bg-[#1a1a17] hover:bg-[#242420] text-[#eceeed] border-[#2e2e28]"
            >
              <Upload className="h-3.5 w-3.5 text-[#8a9e6b]" />
              <span>{isImporting ? tx("Reading File...") : t('settings.backup.importBtn')}</span>
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              aria-label={t('settings.backup.fileInputLabel')}
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: Read-only database integrity check */}
      <section className="rounded-lg border border-border-subtle bg-bg-surface overflow-hidden" aria-labelledby="settings-integrity-title">
        <div className="px-5 py-4 border-b border-[#242420] bg-[#1a1a17]/50 flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-[#8a9e6b]" aria-hidden="true" />
          <h2 id="settings-integrity-title" className="text-xs font-semibold uppercase tracking-wider text-[#eceeed]">
            {t('settings.integrity.title')}
          </h2>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#9ca3af] leading-relaxed">{t('settings.integrity.description')}</p>
          <Button
            variant="secondary"
            onClick={handleIntegrityScan}
            disabled={isCheckingIntegrity}
            aria-busy={isCheckingIntegrity}
            className="gap-1.5 bg-[#1a1a17] hover:bg-[#242420] text-[#eceeed] border-[#2e2e28]"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#8a9e6b]" aria-hidden="true" />
            <span>{isCheckingIntegrity ? t('settings.integrity.checking') : t('settings.integrity.check')}</span>
          </Button>

          <div aria-live="polite" aria-atomic="true">
            {integrityError && (
              <p role="alert" className="text-xs text-red-300">{t('settings.integrity.failed')}</p>
            )}
            {integrityResult && !integrityError && (
              <div className="space-y-3">
                <p className={cn('flex items-center gap-2 text-xs', integrityResult.issues.length === 0 ? 'text-[#a3b899]' : 'text-amber-300')}>
                  {integrityResult.issues.length === 0
                    ? <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    : <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  <span>
                    {integrityResult.issues.length === 0
                      ? t('settings.integrity.clean')
                      : t('settings.integrity.issuesFound', { count: integrityResult.issues.length })}
                  </span>
                </p>
                <p className="text-[11px] text-[#6b7280]">
                  {t('settings.integrity.lastChecked', {
                    time: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(integrityResult.checkedAt),
                  })}
                </p>
                {integrityResult.issues.length > 0 && (
                  <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[#242420] bg-[#0e0e0d] p-3" aria-label={t('settings.integrity.issueList')}>
                    {integrityResult.issues.map((issue, index) => (
                      <li key={`${issue.code}:${issue.table}:${issue.rowId}:${index}`} className="grid gap-x-3 gap-y-1 border-b border-[#242420] pb-2 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <span className="break-all font-mono text-[11px] text-amber-200">{issue.code}</span>
                        <span className="break-all font-mono text-[10px] text-[#9ca3af]">
                          {issue.table} · {issue.rowId}{issue.reference ? ` → ${issue.reference}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 5: Design System & Color Palette */}
      <div className="rounded-xl border border-[#242420] bg-[#141412] overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-[#242420] bg-[#1a1a17]/50 flex items-center gap-2.5">
          <Palette className="h-4 w-4 text-[#8a9e6b]" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#eceeed]">
            {tx("Editorial Charcoal & Olive Design System")}</h2>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#9ca3af] leading-relaxed">
            {tx("The ALTERA interface uses a customized editorial dark-first palette with warm charcoal surfaces, restrained olive and sage-green accents, and elegant serif headings.")}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {themeVariables.map((tok) => (
              <div
                key={tok.label}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#242420] bg-[#0e0e0d]"
              >
                <div
                  className="h-4 w-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                  style={{ backgroundColor: tok.value }}
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono font-medium text-[#eceeed] truncate">
                    {tok.label}
                  </div>
                  <div className="text-[9px] font-mono text-[#6b7280]">
                    {tok.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 6: System Information */}
      <div className="rounded-xl border border-[#242420] bg-[#141412] p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#eceeed]">
          <Info className="h-4 w-4 text-[#8a9e6b]" />
          <span>{tx("About ALTERA")}</span>
        </div>
        <div className="text-xs text-[#9ca3af] space-y-1.5 leading-relaxed font-sans">
          <p>
            {tx("ALTERA is built on Vite, React")} {React.version}{tx(", TypeScript, Tailwind CSS, Radix UI primitives, and Dexie.js for client-side IndexedDB persistence.")}</p>
          <div className="flex items-center gap-4 text-[11px] text-[#6b7280] pt-2 font-mono">
            <span>{tx("Version:")} {appPkg.version}</span>
            <span>{tx("Architecture: Local-First")}</span>
            <span>{tx("Sync: Offline-Capable")}</span>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-md bg-[#141412] border-[#242420] text-[#eceeed]">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-[#eceeed]">
              {t('settings.reset.seedBtn')}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#9ca3af]">
              {t('settings.reset.seedConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#242420]">
            <Button
              variant="ghost"
              onClick={() => setShowResetDialog(false)}
              className="text-[#9ca3af] hover:text-[#eceeed]"
            >
              {tx("Cancel")}</Button>
            <Button
              variant="olive"
              onClick={handleResetDemoData}
              disabled={isResetting}
            >
              {isResetting ? tx("Resetting...") : tx("Confirm Reset")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wipe Confirmation Dialog */}
      <Dialog open={showWipeDialog} onOpenChange={setShowWipeDialog}>
        <DialogContent className="max-w-md bg-[#141412] border-[#242420] text-[#eceeed]">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-red-400">
              {t('settings.reset.wipeConfirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#9ca3af]">
              {t('settings.reset.wipeConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#242420]">
            <Button
              variant="ghost"
              onClick={() => setShowWipeDialog(false)}
              className="text-[#9ca3af] hover:text-[#eceeed]"
            >
              {tx("Cancel")}</Button>
            <Button
              variant="danger"
              onClick={handleWipeAll}
              disabled={isResetting}
            >
              {isResetting ? tx("Wiping...") : t('settings.reset.confirmWipe')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Backup Confirmation Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md bg-[#141412] border-[#242420] text-[#eceeed]">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-[#eceeed]">
              {t('settings.backup.importConfirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#9ca3af]">
              {t('settings.backup.importConfirmDesc', {
                count: Object.keys(pendingImport?.tables || {}).length,
              })}
              <span className="mt-2 block">{t('settings.backup.importRecoveryPolicy')}</span>
            </DialogDescription>
          </DialogHeader>

          {pendingImport && (
            <div className="py-2 space-y-2">
              <div className="text-[11px] font-mono text-[#6b7280]">
                {tx("Backup Date:")}{pendingImport.exportedAt ? new Date(pendingImport.exportedAt).toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US') : tx("Unknown")}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-[#0e0e0d] p-3.5 rounded-xl border border-[#242420]">
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">{tx("Projects:")}</span>
                  <span className="font-mono font-medium text-[#eceeed]">{pendingImport.tables?.projects?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">{tx("Tasks:")}</span>
                  <span className="font-mono font-medium text-[#eceeed]">{pendingImport.tables?.tasks?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">{tx("Sessions:")}</span>
                  <span className="font-mono font-medium text-[#eceeed]">{pendingImport.tables?.sessions?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">{tx("Notes:")}</span>
                  <span className="font-mono font-medium text-[#eceeed]">{pendingImport.tables?.notes?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">{tx("Resources:")}</span>
                  <span className="font-mono font-medium text-[#eceeed]">{pendingImport.tables?.resources?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">{tx("Attachments:")}</span>
                  <span className="font-mono font-medium text-[#eceeed]">{pendingImport.tables?.attachments?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">{tx("Tags:")}</span>
                  <span className="font-mono font-medium text-[#eceeed]">{pendingImport.tables?.tags?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">{tx("Entity Links:")}</span>
                  <span className="font-mono font-medium text-[#eceeed]">{pendingImport.tables?.entityLinks?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#242420]">
            <Button
              variant="ghost"
              onClick={() => {
                setShowImportDialog(false)
                setPendingImport(null)
              }}
              className="text-[#9ca3af] hover:text-[#eceeed]"
            >
              {t('settings.backup.cancel')}
            </Button>
            <Button
              variant="olive"
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{isImporting ? tx("Restoring...") : t('settings.backup.confirmImport')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
