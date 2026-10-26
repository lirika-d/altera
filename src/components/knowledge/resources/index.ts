/**
 * Resources Library Components for ALTERA Knowledge Hub.
 */

export { ResourceCard, type ResourceCardProps } from './ResourceCard'
export { ResourceList, type ResourceListProps } from './ResourceList'
export {
  CreateResourceDialog,
  type CreateResourceDialogProps,
} from './CreateResourceDialog'
export {
  EditResourceDialog,
  type EditResourceDialogProps,
} from './EditResourceDialog'
export {
  ResourceDetailModal,
  type ResourceDetailModalProps,
  ResourceDetailDialog,
  type ResourceDetailDialogProps,
} from './ResourceDetailModal'

export {
  isValidResourceUrl,
  sanitizeResourceUrl,
  getDomainFromUrl,
  formatFileSize,
  copyToClipboard,
  COMMON_LANGUAGES,
  type LanguageOption,
} from './urlSecurity'
