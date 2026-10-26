import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Table as TableIcon,
  Undo2,
  Redo2,
  Minus,
  X,
  Check,
} from 'lucide-react';
import { sanitizeUrl } from './editorTypes';
import { useTranslation } from '@/i18n'

export interface EditorToolbarProps {
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  activeBlockType?: string;
  activeMarks?: {
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
    code?: boolean;
    link?: boolean;
  };
  onToggleMark: (mark: 'bold' | 'italic' | 'strike' | 'code') => void;
  onSetBlockType: (type: string, attrs?: Record<string, unknown>) => void;
  onInsertLink: (url: string) => void;
  onRemoveLink?: () => void;
  onInsertTable: (rows?: number, cols?: number) => void;
  onInsertDivider: () => void;
  isReadOnly?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  activeBlockType = 'paragraph',
  activeMarks = {},
  onToggleMark,
  onSetBlockType,
  onInsertLink,
  onInsertTable,
  onInsertDivider,
  isReadOnly = false,
}) => {
  const { tx } = useTranslation()
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [customRows, setCustomRows] = useState(3);
  const [customCols, setCustomCols] = useState(3);

  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkPopoverOpen && linkInputRef.current) {
      linkInputRef.current.focus();
    }
  }, [linkPopoverOpen]);

  const handleApplyLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = sanitizeUrl(linkUrl);
    if (clean) {
      onInsertLink(clean);
      setLinkUrl('');
      setLinkPopoverOpen(false);
    }
  };

  if (isReadOnly) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label={tx("Formatting options")}
      className="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b border-[#24252c] bg-[#14151a] text-[#868792] select-none text-xs"
    >
      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 pr-1.5 border-r border-[#24252c]">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title={tx("Undo (Ctrl+Z)")}
          aria-label={tx("Undo")}
          className="p-1.5 rounded hover:bg-[#202128] hover:text-[#e4e3e9] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#868792] transition-colors"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title={tx("Redo (Ctrl+Y or Ctrl+Shift+Z)")}
          aria-label={tx("Redo")}
          className="p-1.5 rounded hover:bg-[#202128] hover:text-[#e4e3e9] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#868792] transition-colors"
        >
          <Redo2 size={14} />
        </button>
      </div>

      {/* Block Type Selector */}
      <div className="flex items-center gap-0.5 px-1 border-r border-[#24252c]">
        <button
          type="button"
          onClick={() => onSetBlockType('paragraph')}
          title={tx("Normal Text")}
          aria-label={tx("Normal Text")}
          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
            activeBlockType === 'paragraph'
              ? 'bg-[#27272a] text-[#e4e3e9]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          {tx("Normal")}</button>

        <button
          type="button"
          onClick={() => onSetBlockType('heading', { level: 1 })}
          title={tx("Heading 1")}
          aria-label={tx("Heading 1")}
          className={`p-1.5 rounded transition-colors ${
            activeBlockType === 'heading-1'
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <Heading1 size={14} />
        </button>

        <button
          type="button"
          onClick={() => onSetBlockType('heading', { level: 2 })}
          title={tx("Heading 2")}
          aria-label={tx("Heading 2")}
          className={`p-1.5 rounded transition-colors ${
            activeBlockType === 'heading-2'
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <Heading2 size={14} />
        </button>

        <button
          type="button"
          onClick={() => onSetBlockType('heading', { level: 3 })}
          title={tx("Heading 3")}
          aria-label={tx("Heading 3")}
          className={`p-1.5 rounded transition-colors ${
            activeBlockType === 'heading-3'
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <Heading3 size={14} />
        </button>
      </div>

      {/* Text Formatting Marks */}
      <div className="flex items-center gap-0.5 px-1 border-r border-[#24252c]">
        <button
          type="button"
          onClick={() => onToggleMark('bold')}
          title={tx("Bold (Ctrl+B)")}
          aria-label={tx("Bold")}
          className={`p-1.5 rounded transition-colors ${
            activeMarks.bold
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <Bold size={14} />
        </button>

        <button
          type="button"
          onClick={() => onToggleMark('italic')}
          title={tx("Italic (Ctrl+I)")}
          aria-label={tx("Italic")}
          className={`p-1.5 rounded transition-colors ${
            activeMarks.italic
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <Italic size={14} />
        </button>

        <button
          type="button"
          onClick={() => onToggleMark('strike')}
          title={tx("Strikethrough")}
          aria-label={tx("Strikethrough")}
          className={`p-1.5 rounded transition-colors ${
            activeMarks.strike
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <Strikethrough size={14} />
        </button>

        <button
          type="button"
          onClick={() => onToggleMark('code')}
          title={tx("Inline Code")}
          aria-label={tx("Inline Code")}
          className={`p-1.5 rounded font-mono transition-colors ${
            activeMarks.code
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <Code size={14} />
        </button>

        {/* Link Button with Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLinkPopoverOpen(!linkPopoverOpen)}
            title={tx("Insert Link")}
            aria-label={tx("Insert Link")}
            className={`p-1.5 rounded transition-colors ${
              activeMarks.link || linkPopoverOpen
                ? 'bg-[#27272a] text-[#a58afa]'
                : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
            }`}
          >
            <LinkIcon size={14} />
          </button>

          {linkPopoverOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 p-2 rounded-md border border-[#3f3f46] bg-[#18181b] shadow-2xl z-30">
              <form onSubmit={handleApplyLink} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px] text-[#9798a2] font-medium">
                  <span>{tx("Insert Link")}</span>
                  <button
                    type="button"
                    onClick={() => setLinkPopoverOpen(false)}
                    className="text-[#71717a] hover:text-[#e4e3e9]"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    ref={linkInputRef}
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 px-2 py-1 text-xs bg-[#0f1015] border border-[#27272a] rounded text-[#e4e3e9] placeholder-[#52525b] outline-none focus:border-[#9879f5]"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-[#9878e8] hover:bg-[#a68afa] text-[#121217] rounded font-semibold text-xs transition-colors"
                  >
                    <Check size={12} />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Lists & Quotes */}
      <div className="flex items-center gap-0.5 px-1 border-r border-[#24252c]">
        <button
          type="button"
          onClick={() => onSetBlockType('bulletList')}
          title={tx("Bullet List")}
          aria-label={tx("Bullet List")}
          className={`p-1.5 rounded transition-colors ${
            activeBlockType === 'bulletList'
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <List size={14} />
        </button>

        <button
          type="button"
          onClick={() => onSetBlockType('orderedList')}
          title={tx("Numbered List")}
          aria-label={tx("Numbered List")}
          className={`p-1.5 rounded transition-colors ${
            activeBlockType === 'orderedList'
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <ListOrdered size={14} />
        </button>

        <button
          type="button"
          onClick={() => onSetBlockType('taskList')}
          title={tx("Task List / Checklist")}
          aria-label={tx("Task List")}
          className={`p-1.5 rounded transition-colors ${
            activeBlockType === 'taskList'
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <CheckSquare size={14} />
        </button>

        <button
          type="button"
          onClick={() => onSetBlockType('blockquote')}
          title={tx("Quote Block")}
          aria-label={tx("Quote Block")}
          className={`p-1.5 rounded transition-colors ${
            activeBlockType === 'blockquote'
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <Quote size={14} />
        </button>

        <button
          type="button"
          onClick={() => onSetBlockType('codeBlock', { language: 'typescript' })}
          title={tx("Code Block")}
          aria-label={tx("Code Block")}
          className={`p-1.5 rounded transition-colors ${
            activeBlockType === 'codeBlock'
              ? 'bg-[#27272a] text-[#a58afa]'
              : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
          }`}
        >
          <span className="font-mono text-[11px] font-bold">{'</>'}</span>
        </button>
      </div>

      {/* Tables & Dividers */}
      <div className="flex items-center gap-0.5 pl-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setTableMenuOpen(!tableMenuOpen)}
            title={tx("Insert Table")}
            aria-label={tx("Insert Table")}
            className={`p-1.5 rounded transition-colors ${
              tableMenuOpen ? 'bg-[#27272a] text-[#a58afa]' : 'hover:bg-[#202128] hover:text-[#e4e3e9]'
            }`}
          >
            <TableIcon size={14} />
          </button>

          {tableMenuOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 w-48 p-2 rounded-md border border-[#3f3f46] bg-[#18181b] shadow-2xl z-30 text-xs"
              onMouseLeave={() => setTableMenuOpen(false)}
            >
              <div className="text-[10px] text-[#9798a2] font-semibold mb-2">{tx("Insert Table")}</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[9px] text-[#71717a] block">{tx("Rows")}</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={customRows}
                    onChange={(e) => setCustomRows(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-1.5 py-0.5 bg-[#0f1015] border border-[#27272a] rounded text-xs text-[#e4e3e9]"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[#71717a] block">{tx("Columns")}</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={customCols}
                    onChange={(e) => setCustomCols(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-1.5 py-0.5 bg-[#0f1015] border border-[#27272a] rounded text-xs text-[#e4e3e9]"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onInsertTable(customRows, customCols);
                  setTableMenuOpen(false);
                }}
                className="w-full py-1 bg-[#9878e8] hover:bg-[#a68afa] text-[#121217] font-semibold rounded text-xs transition-colors"
              >
                {tx("Create")} {customRows}×{customCols}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onInsertDivider}
          title={tx("Horizontal Rule")}
          aria-label={tx("Horizontal Rule")}
          className="p-1.5 rounded hover:bg-[#202128] hover:text-[#e4e3e9] transition-colors"
        >
          <Minus size={14} />
        </button>
      </div>
    </div>
  );
};

export interface BubbleToolbarProps {
  position: { top: number; left: number } | null;
  activeMarks?: {
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
    code?: boolean;
    link?: boolean;
  };
  onToggleMark: (mark: 'bold' | 'italic' | 'strike' | 'code') => void;
  onSetBlockType: (type: string, attrs?: Record<string, unknown>) => void;
  onInsertLink: (url: string) => void;
  onClose: () => void;
}

/**
 * Contextual Floating Bubble Toolbar displayed on selection
 */
export const BubbleToolbar: React.FC<BubbleToolbarProps> = ({
  position,
  activeMarks = {},
  onToggleMark,
  onSetBlockType,
  onInsertLink,
  onClose,
}) => {
  const { tx } = useTranslation()
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showLinkInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showLinkInput]);

  if (!position) return null;

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeUrl(url);
    if (clean) {
      onInsertLink(clean);
      setUrl('');
      setShowLinkInput(false);
      onClose();
    }
  };

  return (
    <div
      role="tooltip"
      aria-label={tx("Floating text selection tools")}
      style={{
        top: `${Math.max(10, position.top - 46)}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
      className="fixed z-50 flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-[#3f3f46] bg-[#18181b] shadow-2xl text-[#a1a1aa] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
    >
      {showLinkInput ? (
        <form onSubmit={handleLinkSubmit} className="flex items-center gap-1 px-1">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-48 px-2 py-0.5 text-xs bg-[#0f1015] border border-[#27272a] rounded text-[#e4e3e9] outline-none focus:border-[#9879f5]"
          />
          <button
            type="submit"
            className="p-1 text-[#a58afa] hover:text-[#d1c3f4] transition-colors"
          >
            <Check size={13} />
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="p-1 text-[#71717a] hover:text-[#e4e3e9] transition-colors"
          >
            <X size={13} />
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onToggleMark('bold')}
            title={tx("Bold")}
            className={`p-1 rounded transition-colors ${
              activeMarks.bold
                ? 'bg-[#27272a] text-[#a58afa]'
                : 'hover:bg-[#27272a] hover:text-[#f4f4f5]'
            }`}
          >
            <Bold size={13} />
          </button>

          <button
            type="button"
            onClick={() => onToggleMark('italic')}
            title={tx("Italic")}
            className={`p-1 rounded transition-colors ${
              activeMarks.italic
                ? 'bg-[#27272a] text-[#a58afa]'
                : 'hover:bg-[#27272a] hover:text-[#f4f4f5]'
            }`}
          >
            <Italic size={13} />
          </button>

          <button
            type="button"
            onClick={() => onToggleMark('strike')}
            title={tx("Strikethrough")}
            className={`p-1 rounded transition-colors ${
              activeMarks.strike
                ? 'bg-[#27272a] text-[#a58afa]'
                : 'hover:bg-[#27272a] hover:text-[#f4f4f5]'
            }`}
          >
            <Strikethrough size={13} />
          </button>

          <button
            type="button"
            onClick={() => onToggleMark('code')}
            title={tx("Code")}
            className={`p-1 rounded transition-colors ${
              activeMarks.code
                ? 'bg-[#27272a] text-[#a58afa]'
                : 'hover:bg-[#27272a] hover:text-[#f4f4f5]'
            }`}
          >
            <Code size={13} />
          </button>

          <button
            type="button"
            onClick={() => setShowLinkInput(true)}
            title={tx("Link")}
            className={`p-1 rounded transition-colors ${
              activeMarks.link
                ? 'bg-[#27272a] text-[#a58afa]'
                : 'hover:bg-[#27272a] hover:text-[#f4f4f5]'
            }`}
          >
            <LinkIcon size={13} />
          </button>

          <div className="w-[1px] h-3.5 bg-[#3f3f46] mx-0.5" />

          <button
            type="button"
            onClick={() => onSetBlockType('heading', { level: 1 })}
            title="H1"
            className="p-1 hover:bg-[#27272a] hover:text-[#f4f4f5] rounded transition-colors"
          >
            <Heading1 size={13} />
          </button>

          <button
            type="button"
            onClick={() => onSetBlockType('heading', { level: 2 })}
            title="H2"
            className="p-1 hover:bg-[#27272a] hover:text-[#f4f4f5] rounded transition-colors"
          >
            <Heading2 size={13} />
          </button>
        </>
      )}
    </div>
  );
};
