import * as React from 'react'
import {
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  FileImage,
  FileText,
  FileCode,
  Archive,
  Paperclip,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import type { Attachment } from '@/types'
import {
  formatFileSize,
  getAttachmentCategory,
  useObjectURL,
  readBlobText,
  downloadAttachment,
  type AttachmentCategory,
} from '@/lib/attachments'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/i18n'

export interface AttachmentPreviewDialogProps {
  attachment: Attachment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload?: (attachment: Attachment) => void
}

interface PreviewContentProps {
  attachment: Attachment
  onDownload?: (attachment: Attachment) => void
  onClose: () => void
}

function PreviewContent({ attachment, onDownload, onClose }: PreviewContentProps) {
  const { t, tx } = useTranslation()
  const [zoom, setZoom] = React.useState<number>(1)
  const [textContent, setTextContent] = React.useState<string | null>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)
  const [isLoadingText, setIsLoadingText] = React.useState(false)
  const [isCopied, setIsCopied] = React.useState(false)

  const category: AttachmentCategory = React.useMemo(() => {
    return getAttachmentCategory(attachment.mimeType, attachment.filename)
  }, [attachment])

  // Hook handles auto-creation and cleanup of Blob object URL
  const objectUrl = useObjectURL(category === 'image' ? attachment.blob : null)

  // Load text content asynchronously when previewing text or code
  React.useEffect(() => {
    let active = true

    if (category === 'text' || category === 'code') {
      Promise.resolve().then(async () => {
        setIsLoadingText(true)
        try {
          const result = await readBlobText(attachment.blob)
          if (!active) return
          setTextContent(result.text)
          setIsTruncated(result.truncated)
        } catch {
          if (!active) return
          setTextContent(t('knowledge.attachmentErrors.previewFailed'))
          setIsTruncated(false)
        } finally {
          if (active) setIsLoadingText(false)
        }
      })
    }

    return () => {
      active = false
    }
  }, [attachment, category, t])

  const handleCopyText = React.useCallback(async () => {
    if (!textContent) return
    try {
      await navigator.clipboard.writeText(textContent)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // Clipboard write failed
    }
  }, [textContent])

  const handleDownload = React.useCallback(() => {
    if (onDownload) {
      onDownload(attachment)
    } else {
      downloadAttachment(attachment)
    }
  }, [attachment, onDownload])

  const zoomIn = React.useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3.5))
  }, [])

  const zoomOut = React.useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.35))
  }, [])

  const resetZoom = React.useCallback(() => {
    setZoom(1)
  }, [])

  return (
    <>
      <DialogHeader className="space-y-1">
        <div className="flex items-center gap-2 pr-6">
          <DialogTitle className="truncate font-semibold text-sm">
            {attachment.filename}
          </DialogTitle>
          <Badge variant="secondary" className="uppercase text-[9px] tracking-wider">
            {category}
          </Badge>
        </div>
        <DialogDescription className="text-xs text-text-muted">
          {formatFileSize(attachment.size)} • {attachment.mimeType || tx('Unknown MIME')}
        </DialogDescription>
      </DialogHeader>

      {/* Modal Body */}
      <div className="flex-1 my-2 overflow-hidden flex flex-col min-h-[300px] justify-center">
        {category === 'image' && (
          <div className="flex flex-col h-full space-y-2">
            {/* Zoom Controls */}
            <div className="flex items-center justify-end gap-1.5 px-2 py-1 bg-bg-elevated/70 border border-border/50 rounded-md self-end">
              <Button
                variant="ghost"
                size="xs"
                onClick={zoomOut}
                title={tx("Zoom out")}
                className="h-6 w-6 p-0"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-mono text-text-muted min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={zoomIn}
                title={tx("Zoom in")}
                className="h-6 w-6 p-0"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <div className="w-[1px] h-3 bg-border mx-0.5" />
              <Button
                variant="ghost"
                size="xs"
                onClick={resetZoom}
                title={tx("Reset to 100%")}
                className="h-6 px-1.5 text-[11px] gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>{tx("Fit")}</span>
              </Button>
            </div>

            {/* Image viewport */}
            <div className="flex-1 overflow-auto max-h-[55vh] flex items-center justify-center p-4 bg-bg-base/60 rounded-lg border border-border/60">
              {objectUrl ? (
                <img
                  src={objectUrl}
                  alt={attachment.filename}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                  className="max-h-[50vh] max-w-full object-contain transition-transform duration-150 select-none shadow-md rounded"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
                  <span className="text-xs">{tx("Loading image preview...")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {(category === 'text' || category === 'code') && (
          <div className="flex flex-col h-full space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-text-muted font-mono">
                {category === 'code' ? tx("Code inspection") : tx("Plain text preview")}
              </span>
              <Button
                variant="secondary"
                size="xs"
                onClick={handleCopyText}
                disabled={isLoadingText || !textContent}
                className="h-6 px-2 text-[11px] gap-1"
              >
                {isCopied ? (
                  <>
                    <Check className="h-3 w-3 text-accent-green" />
                    <span>{tx("Copied!")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>{tx("Copy")}</span>
                  </>
                )}
              </Button>
            </div>

            {isTruncated && (
              <div className="flex items-center gap-1.5 p-2 bg-accent-amber/10 border border-accent-amber/20 rounded text-[11px] text-accent-amber">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {tx("Large file truncated for preview performance. Download the file to view the full contents.")}</span>
              </div>
            )}

            <div className="flex-1 overflow-auto max-h-[55vh] bg-bg-base/80 border border-border rounded-lg p-3">
              {isLoadingText ? (
                <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-accent-blue" />
                  <span className="text-xs">{tx("Reading text content...")}</span>
                </div>
              ) : (
                <pre className="font-mono text-xs text-text-primary leading-relaxed whitespace-pre-wrap break-words select-text">
                  {textContent || '(Empty file)'}
                </pre>
              )}
            </div>
          </div>
        )}

        {category !== 'image' && category !== 'text' && category !== 'code' && (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-bg-surface/40 border border-dashed border-border-subtle rounded-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated border border-border text-text-secondary mb-3 shadow-inner">
              {category === 'pdf' ? (
                <FileText className="h-6 w-6 text-accent-red stroke-[1.6]" />
              ) : category === 'archive' ? (
                <Archive className="h-6 w-6 text-accent-blue stroke-[1.6]" />
              ) : (
                <Paperclip className="h-6 w-6 text-text-secondary stroke-[1.6]" />
              )}
            </div>

            <h4 className="text-sm font-medium text-text-primary mb-1">
              {category === 'pdf'
                ? tx("PDF Document")
                : category === 'archive'
                ? 'Compressed Archive'
                : 'Binary File'}
            </h4>

            <p className="text-xs text-text-muted max-w-sm mb-4 leading-relaxed">
              {tx("Direct in-app rendering is not available for this format. You can download the file locally to open it with your system application.")}</p>

            <Button size="sm" onClick={handleDownload} className="gap-1.5">
              <Download className="h-4 w-4" />
              <span>{tx("Download")} {formatFileSize(attachment.size)}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Dialog Footer */}
      <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          {category === 'image' && <FileImage className="h-3.5 w-3.5 text-accent-purple" />}
          {category === 'code' && <FileCode className="h-3.5 w-3.5 text-accent-green" />}
          {category === 'text' && <FileText className="h-3.5 w-3.5 text-accent-amber" />}
          <span>{tx("Stored locally in IndexedDB")}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {tx("Close")}</Button>
          <Button size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span>{tx("Download")}</span>
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

export function AttachmentPreviewDialog({
  attachment,
  open,
  onOpenChange,
  onDownload,
}: AttachmentPreviewDialogProps) {
  if (!attachment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl sm:max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden"
        data-testid="attachment-preview-dialog"
      >
        <PreviewContent
          key={attachment.id}
          attachment={attachment}
          onDownload={onDownload}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
