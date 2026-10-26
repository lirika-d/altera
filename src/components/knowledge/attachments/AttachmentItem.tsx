import * as React from 'react'
import {
  FileImage,
  FileText,
  FileCode,
  Archive,
  Paperclip,
  Download,
  Eye,
  Trash2,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import type { Attachment } from '@/types'
import {
  formatFileSize,
  getAttachmentCategory,
  isPreviewable,
  downloadAttachment,
  type AttachmentCategory,
} from '@/lib/attachments'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

export interface AttachmentItemProps {
  attachment: Attachment
  onDelete?: (id: string) => Promise<void> | void
  onPreview?: (attachment: Attachment) => void
  onDownload?: (attachment: Attachment) => void
  isDeleting?: boolean
  readOnly?: boolean
  className?: string
}

function getCategoryConfig(category: AttachmentCategory) {
  switch (category) {
    case 'image':
      return {
        icon: FileImage,
        colorClass: 'text-accent-purple bg-accent-purple/10 border-accent-purple/20',
        label: 'IMAGE',
      }
    case 'pdf':
      return {
        icon: FileText,
        colorClass: 'text-accent-red bg-accent-red/10 border-accent-red/20',
        label: 'PDF',
      }
    case 'text':
      return {
        icon: FileText,
        colorClass: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20',
        label: 'TEXT',
      }
    case 'code':
      return {
        icon: FileCode,
        colorClass: 'text-accent-green bg-accent-green/10 border-accent-green/20',
        label: 'CODE',
      }
    case 'archive':
      return {
        icon: Archive,
        colorClass: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20',
        label: 'ARCHIVE',
      }
    case 'generic':
    default:
      return {
        icon: Paperclip,
        colorClass: 'text-text-secondary bg-bg-elevated border-border',
        label: 'FILE',
      }
  }
}

export function AttachmentItem({
  attachment,
  onDelete,
  onPreview,
  onDownload,
  isDeleting = false,
  readOnly = false,
  className,
}: AttachmentItemProps) {
  const { tx, i18n } = useTranslation()
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false)
  const [isLocalDeleting, setIsLocalDeleting] = React.useState(false)

  const category = getAttachmentCategory(attachment.mimeType, attachment.filename)
  const config = getCategoryConfig(category)
  const IconComponent = config.icon
  const previewAvailable = isPreviewable(attachment.mimeType, attachment.filename)

  const formattedDate = React.useMemo(() => {
    try {
      const date = new Date(attachment.createdAt)
      return date.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }, [attachment.createdAt, i18n.language])

  const handleDownload = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onDownload) {
        onDownload(attachment)
      } else {
        downloadAttachment(attachment)
      }
    },
    [attachment, onDownload]
  )

  const handlePreview = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (previewAvailable && onPreview) {
        onPreview(attachment)
      }
    },
    [attachment, onPreview, previewAvailable]
  )

  const handleDeleteConfirm = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!onDelete) return

      try {
        setIsLocalDeleting(true)
        await onDelete(attachment.id)
      } finally {
        setIsLocalDeleting(false)
        setIsConfirmingDelete(false)
      }
    },
    [attachment.id, onDelete]
  )

  const handleCancelDelete = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConfirmingDelete(false)
  }, [])

  const deleting = isDeleting || isLocalDeleting

  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-bg-surface hover:bg-bg-hover/40 transition-colors',
        deleting && 'opacity-60 pointer-events-none',
        className
      )}
      data-testid={`attachment-item-${attachment.id}`}
    >
      {/* Icon & File Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border text-center transition-transform group-hover:scale-105',
            config.colorClass
          )}
        >
          <IconComponent className="h-4 w-4 stroke-[1.8]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium text-text-primary truncate block hover:underline cursor-pointer"
              title={attachment.filename}
              onClick={previewAvailable ? handlePreview : handleDownload}
            >
              {attachment.filename}
            </span>
            <Badge variant="subtle" className="text-[9px] px-1 py-0 h-4 uppercase">
              {tx(config.label)}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
            <span>{formatFileSize(attachment.size)}</span>
            {formattedDate && (
              <>
                <span>•</span>
                <span>{formattedDate}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isConfirmingDelete ? (
          <div className="flex items-center gap-1 bg-bg-elevated px-1.5 py-1 rounded border border-accent-red/30 animate-in fade-in-0 duration-150">
            <span className="text-[11px] font-medium text-accent-red pr-1">{tx("Delete?")}</span>
            <Button
              variant="danger"
              size="xs"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              title={tx("Confirm permanent deletion")}
              className="h-6 px-1.5"
            >
              {deleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleCancelDelete}
              disabled={deleting}
              title={tx("Cancel")}
              className="h-6 px-1.5 text-text-secondary hover:text-text-primary"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            {previewAvailable && onPreview && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handlePreview}
                className="h-7 w-7 p-0 text-text-secondary hover:text-text-primary"
                title={tx("Preview attachment")}
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="sr-only">{tx("Preview")}</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="xs"
              onClick={handleDownload}
              className="h-7 w-7 p-0 text-text-secondary hover:text-text-primary"
              title={tx("Download file")}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="sr-only">{tx("Download")}</span>
            </Button>

            {!readOnly && onDelete && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsConfirmingDelete(true)}
                disabled={deleting}
                className="h-7 w-7 p-0 text-text-muted hover:text-accent-red transition-colors"
                title={tx("Delete attachment")}
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span className="sr-only">{tx("Delete")}</span>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
