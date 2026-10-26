export { AttachmentManager } from './AttachmentManager'
export type { AttachmentManagerProps } from './AttachmentManager'

export { AttachmentItem } from './AttachmentItem'
export type { AttachmentItemProps } from './AttachmentItem'

export { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
export type { AttachmentPreviewDialogProps } from './AttachmentPreviewDialog'

// Re-export attachment utilities and types
export {
  MAX_FILE_SIZE,
  formatFileSize,
  validateFileSize,
  validateAttachmentFile,
  getAttachmentCategory,
  isPreviewable,
  sanitizeFilename,
  downloadBlob,
  downloadAttachment,
  createSafeObjectURL,
  useObjectURL,
  isQuotaExceededError,
  getAttachmentErrorMessage,
  readBlobText,
  getStorageEstimate,
} from '@/lib/attachments'

export type {
  AttachmentCategory,
  FileValidationResult,
  StorageEstimateResult,
} from '@/lib/attachments'
