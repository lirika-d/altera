/**
 * Notes Product Components for ALTERA Knowledge Hub.
 */

export { NoteCard, type NoteCardProps } from './NoteCard'
export {
  NoteList,
  type NoteListProps,
  type NoteTab,
  type NoteSortOption,
} from './NoteList'
export { NoteDetail, type NoteDetailProps } from './NoteDetail'
export {
  CreateNoteDialog,
  type CreateNoteDialogProps,
} from './CreateNoteDialog'
export {
  formatTimeAgo,
  slugify,
  generateNoteMarkdown,
  exportNoteAsMarkdown,
} from './noteUtils'
