// Public exports for ALTERA Knowledge Note Editor

export { NoteEditor } from './NoteEditor';
export type { NoteEditorProps } from './editorTypes';

export { EditorToolbar, BubbleToolbar } from './EditorToolbar';
export type { EditorToolbarProps, BubbleToolbarProps } from './EditorToolbar';

export { TableEditor } from './TableEditor';
export type { TableEditorProps } from './TableEditor';

export {
  sanitizeUrl,
  createEmptyDoc,
  normalizeDoc,
  jsonToPlainText,
  docToMarkdown,
  markdownToDoc,
} from './editorTypes';

export type {
  DocRoot,
  DocNode,
  TextMark,
  TextMarkType,
  TextNode,
  DocBlockType,
  HeadingAttrs,
  CodeBlockAttrs,
  TaskItemAttrs,
  TableCellAttrs,
  LinkMarkAttrs,
  AutosaveStatus,
} from './editorTypes';
