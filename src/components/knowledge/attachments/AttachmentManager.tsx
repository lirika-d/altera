import * as React from 'react'
import {
  UploadCloud,
  Paperclip,
  AlertTriangle,
  HardDrive,
  X,
  FilePlus,
  Loader2,
} from 'lucide-react'
import type { Attachment } from '@/types'
import {
  saveAttachment,
  getAttachment,
  deleteAttachment,
} from '@/db/knowledge'
import {
  MAX_FILE_SIZE,
  formatFileSize,
  validateAttachmentFile,
  isQuotaExceededError,
  getStorageEstimate,
  type StorageEstimateResult,
} from '@/lib/attachments'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { AttachmentItem } from './AttachmentItem'
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

export interface AttachmentManagerProps {
  /** Explicit list of attachment objects */
  attachments?: Attachment[]
  /** Attachment IDs to load directly from IndexedDB */
  attachmentIds?: string[]
  /** Callback fired when a new attachment is uploaded & stored in IndexedDB */
  onAttachmentAdded?: (attachment: Attachment) => void
  /** Callback fired when an attachment is deleted */
  onAttachmentRemoved?: (attachmentId: string) => void
  /** Callback fired on error */
  onError?: (errorMessage: string) => void
  /** Maximum file size in bytes (defaults to 10 MB) */
  maxFileSize?: number
  /** Allowed MIME types or file extensions (e.g., "image/*,.pdf") */
  accept?: string
  /** Whether multiple files can be uploaded concurrently (default: true) */
  multiple?: boolean
  /** Read-only mode hides dropzone and delete controls */
  readOnly?: boolean
  /** Custom heading title */
  title?: string
  /** Custom description */
  description?: string
  /** Container className */
  className?: string
}

export function AttachmentManager({
  attachments: controlledAttachments,
  attachmentIds,
  onAttachmentAdded,
  onAttachmentRemoved,
  onError,
  maxFileSize = MAX_FILE_SIZE,
  accept,
  multiple = true,
  readOnly = false,
  title = 'Attachments',
  description,
  className,
}: AttachmentManagerProps) {
  const { t, tx } = useTranslation()
  // Local state when IDs or internal mode is used
  const [internalAttachments, setInternalAttachments] = React.useState<Attachment[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  // Drag & drop state
  const [isDragging, setIsDragging] = React.useState(false)
  const dragCounterRef = React.useRef(0)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Error feedback & Storage Quota
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isQuotaError, setIsQuotaError] = React.useState(false)
  const [storageEstimate, setStorageEstimate] = React.useState<StorageEstimateResult | null>(null)

  // Preview dialog state
  const [previewAttachment, setPreviewAttachment] = React.useState<Attachment | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)

  // Load attachments by IDs if attachmentIds is passed and controlledAttachments is not
  React.useEffect(() => {
    if (controlledAttachments !== undefined) return
    let active = true

    Promise.resolve().then(async () => {
      if (!attachmentIds || attachmentIds.length === 0) {
        if (active) setInternalAttachments([])
        return
      }

      if (active) setIsLoading(true)
      try {
        const results = await Promise.all(attachmentIds.map((id) => getAttachment(id)))
        if (!active) return
        const valid = results.filter((item): item is Attachment => item !== undefined)
        setInternalAttachments(valid)
      } catch {
        if (!active) return
        const msg = t('knowledge.attachmentErrors.loadFailed')
        setErrorMessage(msg)
      } finally {
        if (active) setIsLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [controlledAttachments, attachmentIds, t])

  // Check browser storage estimate periodically / on mount
  React.useEffect(() => {
    getStorageEstimate().then((estimate) => {
      if (estimate) setStorageEstimate(estimate)
    })
  }, [])

  // Effective list of attachments
  const activeList: Attachment[] = controlledAttachments ?? internalAttachments

  const handleOpenPicker = React.useCallback(() => {
    if (readOnly || isUploading) return
    fileInputRef.current?.click()
  }, [readOnly, isUploading])

  const processFiles = React.useCallback(
    async (files: FileList | File[]) => {
      if (readOnly || files.length === 0) return

      setErrorMessage(null)
      setIsQuotaError(false)
      setIsUploading(true)

      const fileList = Array.from(files)
      const errors: string[] = []

      for (const file of fileList) {
        // 1. Validate file size
        const validation = validateAttachmentFile(file, maxFileSize)
        if (!validation.valid) {
          errors.push(t('knowledge.attachmentErrors.tooLarge', {
            name: file.name,
            limit: formatFileSize(maxFileSize),
          }))
          continue
        }

        // 2. Persist to IndexedDB
        try {
          const saved = await saveAttachment(file)

          if (controlledAttachments === undefined) {
            setInternalAttachments((prev) => [...prev, saved])
          }

          onAttachmentAdded?.(saved)
        } catch (err) {
          const quotaExceeded = isQuotaExceededError(err)
          if (quotaExceeded) {
            setIsQuotaError(true)
            errors.push(
              t('knowledge.attachmentErrors.quotaExceeded', { name: file.name })
            )
          } else {
            errors.push(t('knowledge.attachmentErrors.uploadFailed', { name: file.name }))
          }
        }
      }

      setIsUploading(false)

      if (errors.length > 0) {
        const fullMessage = errors.join(' \n')
        setErrorMessage(fullMessage)
        onError?.(fullMessage)
      }

      // Refresh storage estimate after uploads
      getStorageEstimate().then((estimate) => {
        if (estimate) setStorageEstimate(estimate)
      })
    },
    [readOnly, maxFileSize, controlledAttachments, onAttachmentAdded, onError, t]
  )

  const handleFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files)
      }
      // Reset input value so re-selecting the same file works
      e.target.value = ''
    },
    [processFiles]
  )

  const handleDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (readOnly) return
      dragCounterRef.current += 1
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true)
      }
    },
    [readOnly]
  )

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (readOnly) return
      dragCounterRef.current -= 1
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsDragging(false)
      }
    },
    [readOnly]
  )

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (readOnly) return
      e.dataTransfer.dropEffect = 'copy'
    },
    [readOnly]
  )

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (readOnly) return

      dragCounterRef.current = 0
      setIsDragging(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files)
      }
    },
    [readOnly, processFiles]
  )

  const handleDelete = React.useCallback(
    async (id: string) => {
      if (readOnly) return

      try {
        await deleteAttachment(id)

        if (controlledAttachments === undefined) {
          setInternalAttachments((prev) => prev.filter((item) => item.id !== id))
        }

        onAttachmentRemoved?.(id)

        // Refresh storage estimate after deletion
        getStorageEstimate().then((estimate) => {
          if (estimate) setStorageEstimate(estimate)
        })
      } catch {
        const msg = t('knowledge.attachmentErrors.deleteFailed')
        setErrorMessage(msg)
        onError?.(msg)
      }
    },
    [readOnly, controlledAttachments, onAttachmentRemoved, onError, t]
  )

  const handlePreview = React.useCallback((attachment: Attachment) => {
    setPreviewAttachment(attachment)
    setIsPreviewOpen(true)
  }, [])

  return (
    <div
      className={cn('space-y-4', className)}
      data-testid="attachment-manager"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={readOnly || isUploading}
        data-testid="attachment-file-input"
      />

      {/* Header with Title and Limits */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5 text-accent-blue" />
              <span>{title}</span>
            </h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
              {activeList.length}
            </Badge>
          </div>
          {description && (
            <p className="text-[11px] text-text-muted mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Storage Quota Hint */}
          {storageEstimate && (
            <div
              className="hidden sm:flex items-center gap-1 text-[10px] text-text-muted"
              title={`Used ${storageEstimate.formattedUsage} of ${storageEstimate.formattedQuota}`}
            >
              <HardDrive className="h-3 w-3" />
              <span>{storageEstimate.percentUsed}{tx("% storage used")}</span>
            </div>
          )}

          {!readOnly && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenPicker}
              disabled={isUploading}
              className="gap-1.5 text-xs h-7"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-blue" />
                  <span>{tx("Saving...")}</span>
                </>
              ) : (
                <>
                  <FilePlus className="h-3.5 w-3.5" />
                  <span>{tx("Add Files")}</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error / Quota Exceeded Notification */}
      {errorMessage && (
        <div
          className={cn(
            'flex items-start justify-between gap-2 p-3 rounded-lg border text-xs animate-in fade-in-0 duration-150',
            isQuotaError
              ? 'bg-accent-red/10 border-accent-red/30 text-accent-red'
              : 'bg-accent-amber/10 border-accent-amber/30 text-accent-amber'
          )}
          role="alert"
          data-testid="attachment-error-alert"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="whitespace-pre-line text-[11px] leading-relaxed">
              {errorMessage}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
            title={tx("Dismiss error")}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">{tx("Dismiss")}</span>
          </button>
        </div>
      )}

      {/* Drag & Drop Dropzone */}
      {!readOnly && (
        <div
          onClick={handleOpenPicker}
          className={cn(
            'relative flex flex-col items-center justify-center p-5 rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer select-none text-center',
            isDragging
              ? 'border-accent-blue bg-accent-blue/10 scale-[1.01] shadow-lg shadow-accent-blue/5 ring-2 ring-accent-blue/30'
              : 'border-border-subtle bg-bg-surface/40 hover:bg-bg-surface/80 hover:border-border',
            isUploading && 'pointer-events-none opacity-60'
          )}
          data-testid="attachment-dropzone"
        >
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full mb-2 transition-transform duration-200',
              isDragging
                ? 'bg-accent-blue text-white scale-110'
                : 'bg-bg-elevated border border-border text-text-secondary'
            )}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-accent-blue" />
            ) : (
              <UploadCloud className="h-5 w-5 stroke-[1.8]" />
            )}
          </div>

          <p className="text-xs font-medium text-text-primary mb-1">
            {isDragging
              ? tx("Drop files now to attach")
              : isUploading
              ? 'Storing in local IndexedDB vault...'
              : 'Drag and drop files here, or click to browse'}
          </p>

          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className="text-[10px] text-text-muted border-border/60 bg-bg-elevated/40"
            >
              {tx("Max")} {formatFileSize(maxFileSize)} {tx("per file")}</Badge>
            <span className="text-[10px] text-text-muted">{tx("• Local offline storage")}</span>
          </div>
        </div>
      )}

      {/* Attachments List */}
      <div className="space-y-2" data-testid="attachment-list">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-text-muted text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent-blue" />
            <span>{tx("Loading attachments...")}</span>
          </div>
        ) : activeList.length === 0 ? (
          readOnly ? (
            <EmptyState
              icon={Paperclip}
              title={tx("No attachments")}
              description={t('knowledge.empty.noFiles')}
              className="py-6"
            />
          ) : null
        ) : (
          activeList.map((att) => (
            <AttachmentItem
              key={att.id}
              attachment={att}
              onPreview={handlePreview}
              onDelete={readOnly ? undefined : handleDelete}
              readOnly={readOnly}
            />
          ))
        )}
      </div>

      {/* Attachment Preview Modal */}
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </div>
  )
}
