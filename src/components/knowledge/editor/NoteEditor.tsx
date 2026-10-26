import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Check,
  Loader2,
  AlertCircle,
  CircleDot,
  Copy,
  Plus,
  Trash2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Minus,
  CheckCheck,
} from 'lucide-react';
import type {
  DocRoot,
  DocNode,
  TextMark,
  AutosaveStatus,
  NoteEditorProps,
} from './editorTypes';
import {
  normalizeDoc,
  jsonToPlainText,
  sanitizeUrl,
  inlineContentToHTML,
  createEmptyTable,
} from './editorTypes';
import { EditorToolbar, BubbleToolbar } from './EditorToolbar';
import { TableEditor } from './TableEditor';
import { SerializedSaveCoordinator } from './saveCoordinator';
import {
  readNoteDraft,
  removeNoteDraft,
  writeNoteDraft,
  type NoteDraftRecovery,
  type NoteDraftSnapshot,
} from './draftRecovery';
import { useTranslation } from '@/i18n';

const SUPPORTED_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'html',
  'css',
  'json',
  'sql',
  'bash',
  'rust',
  'go',
  'markdown',
  'plaintext',
];

interface HistoryState {
  past: DocRoot[];
  future: DocRoot[];
}

/**
 * Extracts inline text and marks from a DOM element
 */
function domToInlineContent(el: Node): DocNode[] {
  const result: DocNode[] = [];

  function walk(node: Node, currentMarks: TextMark[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        result.push({
          type: 'text',
          text,
          marks: currentMarks.length > 0 ? [...currentMarks] : undefined,
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;
      const tag = elem.tagName.toLowerCase();
      const nextMarks = [...currentMarks];

      if (tag === 'strong' || tag === 'b') {
        if (!nextMarks.some((m) => m.type === 'bold')) nextMarks.push({ type: 'bold' });
      } else if (tag === 'em' || tag === 'i') {
        if (!nextMarks.some((m) => m.type === 'italic')) nextMarks.push({ type: 'italic' });
      } else if (tag === 's' || tag === 'strike' || tag === 'del') {
        if (!nextMarks.some((m) => m.type === 'strike')) nextMarks.push({ type: 'strike' });
      } else if (tag === 'code') {
        if (!nextMarks.some((m) => m.type === 'code')) nextMarks.push({ type: 'code' });
      } else if (tag === 'a') {
        const rawHref = elem.getAttribute('href');
        const href = sanitizeUrl(rawHref);
        if (href && !nextMarks.some((m) => m.type === 'link')) {
          nextMarks.push({
            type: 'link',
            attrs: { href, target: '_blank', rel: 'noopener noreferrer' },
          });
        }
      }

      for (let i = 0; i < elem.childNodes.length; i++) {
        walk(elem.childNodes[i], nextMarks);
      }
    }
  }

  for (let i = 0; i < el.childNodes.length; i++) {
    walk(el.childNodes[i], []);
  }

  return result.length > 0 ? result : [];
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  initialContentJSON,
  title: externalTitle,
  onTitleChange,
  onSave,
  onDraftChange,
  onDraftSaved,
  noteId,
  isReadOnly = false,
  expectedRevision,
  lastSavedAt: externalLastSavedAt,
  placeholder = 'Start writing or type "/" for blocks...',
  className = '',
  autoFocus = false,
}) => {
  const { t, tx, i18n } = useTranslation();
  // Document state
  const [doc, setDoc] = useState<DocRoot>(() => normalizeDoc(initialContentJSON));
  const [title, setTitle] = useState<string>(externalTitle || '');
  const [revision, setRevision] = useState<number>(expectedRevision || 1);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recoveryDraft, setRecoveryDraft] = useState<NoteDraftRecovery | null>(null);
  const [draftStorageMode, setDraftStorageMode] = useState<'local' | 'session' | 'unavailable'>('local');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    if (externalLastSavedAt) {
      const d = new Date(externalLastSavedAt);
      return isNaN(d.getTime()) ? String(externalLastSavedAt) : d.toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return null;
  });

  // History stack for Undo/Redo
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });

  // Floating selection bubble toolbar
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);
  const [activeMarks, setActiveMarks] = useState<Record<string, boolean>>({});

  // Active block focus index
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number | null>(null);

  // Slash commands menu state
  const [slashMenu, setSlashMenu] = useState<{
    blockIndex: number;
    query: string;
    coords: { top: number; left: number };
  } | null>(null);

  // Copied code block state feedback
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // References for serialized autosave and unmount cleanup.
  const docRef = useRef(doc);
  const revisionRef = useRef(revision);
  const titleRef = useRef(title);
  const hasLocalEditsRef = useRef(false);
  const lastInitialContentRef = useRef(initialContentJSON);
  const recoveryCheckedRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<(HTMLElement | null)[]>([]);

  // The mount flag is read only by async callbacks; it prevents post-unmount state writes.
  // eslint-disable-next-line react/refs
  const [coordinator] = useState(() => new SerializedSaveCoordinator<NoteDraftSnapshot>(expectedRevision || 1, {
      save: async (snapshot, expectedRev) => {
        if (!onSave) throw new Error('Note save handler is unavailable');
        return onSave(snapshot.contentJSON, snapshot.plainText, expectedRev, snapshot.title);
      },
      onStatusChange: (status, error) => {
        if (!mountedRef.current) return;
        setSaveStatus(status);
        if (error) {
          setSaveError(status === 'conflict'
            ? t('knowledge.editor.revisionConflict')
            : t('knowledge.editor.failed'));
        } else if (status === 'unsaved' || status === 'saving' || status === 'saved') {
          setSaveError(null);
        }
      },
      onSaved: (snapshot, nextRevision, pendingSnapshot) => {
        if (!pendingSnapshot) {
          hasLocalEditsRef.current = false;
          onDraftSaved?.();
        }
        if (mountedRef.current) {
          const latestRevision = Math.max(revisionRef.current, nextRevision);
          revisionRef.current = latestRevision;
          setRevision(latestRevision);
          setSaveError(null);
          setLastSavedTime(null);
        }

        if (noteId) {
          if (pendingSnapshot) {
            const result = writeNoteDraft(noteId, pendingSnapshot, nextRevision);
            if (mountedRef.current) setDraftStorageMode(result?.storage ?? 'unavailable');
          } else {
            const storedDraft = readNoteDraft(noteId);
            if (
              storedDraft?.title === snapshot.title &&
              storedDraft.contentJSON === snapshot.contentJSON &&
              storedDraft.plainText === snapshot.plainText
            ) {
              removeNoteDraft(noteId);
            }
            if (mountedRef.current) setDraftStorageMode('local');
          }
        }
      },
    }));

  // Auto focus on mount if requested
  useEffect(() => {
    if (autoFocus && !isReadOnly) {
      setTimeout(() => {
        blockRefs.current[0]?.focus();
      }, 50);
    }
  }, [autoFocus, isReadOnly]);

  // Sync external title if changed
  useEffect(() => {
    if (externalTitle !== undefined && externalTitle !== title) {
      setTitle(externalTitle);
      titleRef.current = externalTitle;
    }
  }, [externalTitle, title]);

  // The parent passes revisions returned by this editor's own metadata writes.
  // A revision from another tab is deliberately not adopted here.
  useEffect(() => {
    if (expectedRevision !== undefined && expectedRevision > revisionRef.current) {
      revisionRef.current = expectedRevision;
      coordinator.adoptRevision(expectedRevision);
      setRevision(expectedRevision);
    }
  }, [coordinator, expectedRevision]);

  // Follow live-query content changes only while this editor has no local draft.
  useEffect(() => {
    if (initialContentJSON && initialContentJSON !== lastInitialContentRef.current) {
      lastInitialContentRef.current = initialContentJSON;
      if (hasLocalEditsRef.current) return;
      const normalized = normalizeDoc(initialContentJSON);
      if (normalized.content.length > 0) {
        docRef.current = normalized;
        setDoc(normalized);
      }
    }
  }, [initialContentJSON]);

  // Plain text extraction and word/char count
  const plainText = useMemo(() => jsonToPlainText(doc), [doc]);
  const charCount = plainText.length;
  const wordCount = useMemo(() => {
    const trimmed = plainText.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [plainText]);

  const stageSnapshot = useCallback((targetDoc: DocRoot, targetTitle: string) => {
    if (isReadOnly) return;
    if (expectedRevision !== undefined && expectedRevision > revisionRef.current) {
      revisionRef.current = expectedRevision;
      coordinator.adoptRevision(expectedRevision);
      setRevision(expectedRevision);
    }
    const snapshot: NoteDraftSnapshot = {
      contentJSON: JSON.stringify(targetDoc),
      plainText: jsonToPlainText(targetDoc),
      title: targetTitle,
    };
    hasLocalEditsRef.current = true;
    onDraftChange?.(revisionRef.current);
    coordinator.stage(snapshot);
    if (noteId) {
      const result = writeNoteDraft(noteId, snapshot, coordinator.revision);
      setDraftStorageMode(result?.storage ?? 'unavailable');
    }
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      void coordinator.flush().catch(() => undefined);
    }, 600);
  }, [coordinator, expectedRevision, isReadOnly, noteId, onDraftChange]);

  const performSave = useCallback(async () => {
    if (isReadOnly) return;
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (!coordinator.pendingSnapshot) return;
    try {
      await coordinator.flush();
    } catch (error) {
      console.error('NoteEditor: autosave failed', error);
    }
  }, [coordinator, isReadOnly]);

  // Trigger debounced autosave
  const triggerDebouncedSave = useCallback((nextDoc: DocRoot) => {
    stageSnapshot(nextDoc, titleRef.current);
  }, [stageSnapshot]);

  // Flush pending changes on blur or unmount
  const flushPendingSave = useCallback(() => performSave(), [performSave]);

  const restoreRecoveredDraft = useCallback(() => {
    if (!recoveryDraft || recoveryDraft.baseRevision !== revisionRef.current) return;
    const recoveredDoc = normalizeDoc(recoveryDraft.contentJSON);
    titleRef.current = recoveryDraft.title;
    docRef.current = recoveredDoc;
    setTitle(recoveryDraft.title);
    setDoc(recoveredDoc);
    setRecoveryDraft(null);
    stageSnapshot(recoveredDoc, recoveryDraft.title);
  }, [recoveryDraft, stageSnapshot]);

  const copyRecoveredDraft = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setSaveError(t('knowledge.editor.copyFailed'));
    }
  }, [t]);

  const copyPendingDraft = useCallback(() => {
    const pending = coordinator.pendingSnapshot;
    if (pending) void copyRecoveredDraft(`${pending.title}\n\n${pending.plainText}`);
  }, [coordinator, copyRecoveredDraft]);

  const downloadDraft = useCallback((draft: object) => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `altera-note-draft-${noteId || 'recovery'}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [noteId]);

  const downloadPendingDraft = useCallback(() => {
    const pending = coordinator.pendingSnapshot;
    if (pending) {
      downloadDraft({
        ...pending,
        noteId: noteId || '',
        baseRevision: coordinator.revision,
      });
    }
  }, [coordinator, downloadDraft, noteId]);

  // Local recovery is synchronous; async flush on teardown is best effort only.
  useEffect(() => {
    mountedRef.current = true;
    const flushOnVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flushPendingSave();
    };
    const flushBeforeUnload = () => { void flushPendingSave(); };
    document.addEventListener('visibilitychange', flushOnVisibilityChange);
    window.addEventListener('beforeunload', flushBeforeUnload);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', flushOnVisibilityChange);
      window.removeEventListener('beforeunload', flushBeforeUnload);
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (coordinator.pendingSnapshot) void coordinator.flush().catch(() => undefined);
    };
  }, [coordinator, flushPendingSave]);

  useEffect(() => {
    if (!noteId || recoveryCheckedRef.current) return;
    recoveryCheckedRef.current = true;
    const storedDraft = readNoteDraft(noteId);
    if (!storedDraft) return;

    const initialJSON = typeof initialContentJSON === 'string'
      ? initialContentJSON
      : JSON.stringify(normalizeDoc(initialContentJSON));
    const normalizedInitial = JSON.stringify(normalizeDoc(initialJSON));
    const normalizedDraft = JSON.stringify(normalizeDoc(storedDraft.contentJSON));
    if (storedDraft.title === (externalTitle || '') && normalizedDraft === normalizedInitial) {
      removeNoteDraft(noteId);
      return;
    }
    setRecoveryDraft(storedDraft);
    setSaveStatus(storedDraft.baseRevision === revisionRef.current ? 'unsaved' : 'conflict');
  }, [externalTitle, initialContentJSON, noteId]);

  // Update document helper (with history push)
  const updateDoc = useCallback(
    (nextDoc: DocRoot, addToHistory = true) => {
      if (addToHistory) {
        setHistory((prev) => ({
          past: [...prev.past.slice(-50), docRef.current],
          future: [],
        }));
      }
      docRef.current = nextDoc;
      setDoc(nextDoc);
      triggerDebouncedSave(nextDoc);
    },
    [triggerDebouncedSave]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previousDoc = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);
      const newFuture = [docRef.current, ...prev.future];

      docRef.current = previousDoc;
      setDoc(previousDoc);
      triggerDebouncedSave(previousDoc);
      return { past: newPast, future: newFuture };
    });
  }, [triggerDebouncedSave]);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const nextDoc = prev.future[0];
      const newFuture = prev.future.slice(1);
      const newPast = [...prev.past, docRef.current];

      docRef.current = nextDoc;
      setDoc(nextDoc);
      triggerDebouncedSave(nextDoc);
      return { past: newPast, future: newFuture };
    });
  }, [triggerDebouncedSave]);

  // Selection change listener for Bubble Toolbar
  const handleSelectionCheck = useCallback(() => {
    if (isReadOnly) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setBubblePos(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const container = editorContainerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      setBubblePos(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setBubblePos(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setBubblePos({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });

    // Check active marks
    setActiveMarks({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      strike: document.queryCommandState('strikeThrough'),
    });
  }, [isReadOnly]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionCheck);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionCheck);
    };
  }, [handleSelectionCheck]);

  // Handle Mark toggling (Bold, Italic, Strike, Code)
  const handleToggleMark = useCallback(
    (mark: 'bold' | 'italic' | 'strike' | 'code') => {
      if (isReadOnly) return;

      if (mark === 'bold') {
        document.execCommand('bold', false);
      } else if (mark === 'italic') {
        document.execCommand('italic', false);
      } else if (mark === 'strike') {
        document.execCommand('strikeThrough', false);
      } else if (mark === 'code') {
        // Toggle inline code tag
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const parentCode = range.commonAncestorContainer.parentElement?.closest('code');
          if (parentCode) {
            // Unwrap code
            const textNode = document.createTextNode(parentCode.textContent || '');
            parentCode.parentNode?.replaceChild(textNode, parentCode);
          } else {
            // Wrap in code
            const codeEl = document.createElement('code');
            codeEl.className = 'px-1 py-0.5 rounded bg-[#202128] text-[#a58afa] font-mono text-xs';
            codeEl.appendChild(range.extractContents());
            range.insertNode(codeEl);
          }
        }
      }

      // Sync active block DOM back to doc
      if (focusedBlockIndex !== null) {
        const el = blockRefs.current[focusedBlockIndex];
        if (el) {
          const newInline = domToInlineContent(el);
          const updatedContent = [...doc.content];
          updatedContent[focusedBlockIndex] = {
            ...updatedContent[focusedBlockIndex],
            content: newInline,
          };
          updateDoc({ ...doc, content: updatedContent });
        }
      }

      handleSelectionCheck();
    },
    [doc, focusedBlockIndex, handleSelectionCheck, isReadOnly, updateDoc]
  );

  // Handle Insert Link
  const handleInsertLink = useCallback(
    (url: string) => {
      if (isReadOnly) return;
      const clean = sanitizeUrl(url);
      if (!clean) return;

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const a = document.createElement('a');
        a.href = clean;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'text-[#9878e8] underline underline-offset-2 hover:text-[#b19aff]';
        a.appendChild(range.extractContents());
        range.insertNode(a);

        // Sync active block
        if (focusedBlockIndex !== null) {
          const el = blockRefs.current[focusedBlockIndex];
          if (el) {
            const newInline = domToInlineContent(el);
            const updatedContent = [...doc.content];
            updatedContent[focusedBlockIndex] = {
              ...updatedContent[focusedBlockIndex],
              content: newInline,
            };
            updateDoc({ ...doc, content: updatedContent });
          }
        }
      }
      setBubblePos(null);
    },
    [doc, focusedBlockIndex, isReadOnly, updateDoc]
  );

  // Set block type for currently focused block (or append new block)
  const handleSetBlockType = useCallback(
    (type: string, attrs?: Record<string, unknown>) => {
      if (isReadOnly) return;
      const targetIdx = focusedBlockIndex !== null ? focusedBlockIndex : doc.content.length - 1;
      const updatedContent = [...doc.content];

      let newBlock: DocNode;
      const existingText = updatedContent[targetIdx]?.content || [];

      if (type === 'heading') {
        const level = (typeof attrs?.level === 'number' ? attrs.level : 1) as 1 | 2 | 3;
        newBlock = {
          type: 'heading',
          attrs: { level },
          content: existingText,
        };
      } else if (type === 'paragraph') {
        newBlock = {
          type: 'paragraph',
          content: existingText,
        };
      } else if (type === 'blockquote') {
        newBlock = {
          type: 'blockquote',
          content: existingText,
        };
      } else if (type === 'codeBlock') {
        const plain = existingText.map((n) => n.text || '').join('');
        const language = typeof attrs?.language === 'string' ? attrs.language : 'typescript';
        newBlock = {
          type: 'codeBlock',
          attrs: { language },
          content: [{ type: 'text', text: plain }],
        };
      } else if (type === 'bulletList') {
        newBlock = {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: existingText }],
            },
          ],
        };
      } else if (type === 'orderedList') {
        newBlock = {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: existingText }],
            },
          ],
        };
      } else if (type === 'taskList') {
        newBlock = {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: existingText }],
            },
          ],
        };
      } else {
        newBlock = {
          type: 'paragraph',
          content: existingText,
        };
      }

      if (targetIdx >= 0 && targetIdx < updatedContent.length) {
        updatedContent[targetIdx] = newBlock;
      } else {
        updatedContent.push(newBlock);
      }

      updateDoc({ ...doc, content: updatedContent });
      setSlashMenu(null);
    },
    [doc, focusedBlockIndex, isReadOnly, updateDoc]
  );

  // Insert Table Block
  const handleInsertTable = useCallback(
    (rows = 3, cols = 3) => {
      if (isReadOnly) return;
      const tableNode = createEmptyTable(rows, cols);
      const targetIdx = focusedBlockIndex !== null ? focusedBlockIndex + 1 : doc.content.length;
      const updatedContent = [...doc.content];
      updatedContent.splice(targetIdx, 0, tableNode);
      updateDoc({ ...doc, content: updatedContent });
      setSlashMenu(null);
    },
    [doc, focusedBlockIndex, isReadOnly, updateDoc]
  );

  // Insert Horizontal Rule Divider
  const handleInsertDivider = useCallback(() => {
    if (isReadOnly) return;
    const hrNode: DocNode = { type: 'horizontalRule' };
    const pNode: DocNode = { type: 'paragraph', content: [] };
    const targetIdx = focusedBlockIndex !== null ? focusedBlockIndex + 1 : doc.content.length;
    const updatedContent = [...doc.content];
    updatedContent.splice(targetIdx, 0, hrNode, pNode);
    updateDoc({ ...doc, content: updatedContent });
  }, [doc, focusedBlockIndex, isReadOnly, updateDoc]);

  // Copy code block to clipboard
  const handleCopyCode = async (index: number, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback
      setCopiedIndex(null);
    }
  };

  // Toggle Task item checkbox
  const handleToggleTask = (blockIndex: number, itemIndex: number) => {
    if (isReadOnly) return;
    const targetBlock = doc.content[blockIndex];
    if (targetBlock.type !== 'taskList' || !targetBlock.content) return;

    const updatedItems = targetBlock.content.map((item, idx) => {
      if (idx !== itemIndex) return item;
      const currentChecked = item.attrs?.checked || false;
      return {
        ...item,
        attrs: { ...item.attrs, checked: !currentChecked },
      };
    });

    const updatedBlocks = [...doc.content];
    updatedBlocks[blockIndex] = {
      ...targetBlock,
      content: updatedItems,
    };

    updateDoc({ ...doc, content: updatedBlocks });
  };

  // Keyboard shortcut listener on editor container
  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (isReadOnly) return;

    // Ctrl+S / Cmd+S -> Save now
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      flushPendingSave();
      return;
    }

    // Ctrl+Z -> Undo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z -> Redo
    if (
      ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
    ) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Ctrl+B -> Bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      handleToggleMark('bold');
      return;
    }

    // Ctrl+I -> Italic
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      handleToggleMark('italic');
      return;
    }
  };

  // Handle in-block key events (Enter to create new block, Backspace to delete/merge)
  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    bIdx: number,
    block: DocNode
  ) => {
    if (isReadOnly) return;

    // Handle Slash Command key
    if (e.key === '/') {
      const rect = e.currentTarget.getBoundingClientRect();
      setSlashMenu({
        blockIndex: bIdx,
        query: '',
        coords: { top: rect.bottom + 4, left: rect.left },
      });
    }

    // Enter Key
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // In lists: if current item is empty, escape list into paragraph
      if (block.type === 'bulletList' || block.type === 'orderedList' || block.type === 'taskList') {
        const text = e.currentTarget.textContent?.trim() || '';
        if (!text) {
          // Convert block to empty paragraph
          const updated = [...doc.content];
          updated[bIdx] = { type: 'paragraph', content: [] };
          updateDoc({ ...doc, content: updated });
          return;
        }

        // Add next list item
        if (block.type === 'taskList') {
          const updated = [...doc.content];
          const curItems = block.content || [];
          updated[bIdx] = {
            ...block,
            content: [
              ...curItems,
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{ type: 'paragraph', content: [] }],
              },
            ],
          };
          updateDoc({ ...doc, content: updated });
          return;
        }
      }

      // Default: Insert new paragraph below
      const updated = [...doc.content];
      updated.splice(bIdx + 1, 0, { type: 'paragraph', content: [] });
      updateDoc({ ...doc, content: updated });

      setTimeout(() => {
        const nextEl = blockRefs.current[bIdx + 1];
        if (nextEl) {
          nextEl.focus();
        }
      }, 10);
      return;
    }

    // Backspace on empty block
    if (e.key === 'Backspace') {
      const text = e.currentTarget.textContent || '';
      if (!text.trim()) {
        if (block.type !== 'paragraph') {
          e.preventDefault();
          // Convert back to paragraph
          const updated = [...doc.content];
          updated[bIdx] = { type: 'paragraph', content: [] };
          updateDoc({ ...doc, content: updated });
          return;
        } else if (doc.content.length > 1) {
          e.preventDefault();
          // Delete empty paragraph
          const updated = doc.content.filter((_, i) => i !== bIdx);
          updateDoc({ ...doc, content: updated });
          setTimeout(() => {
            const prevIdx = Math.max(0, bIdx - 1);
            blockRefs.current[prevIdx]?.focus();
          }, 10);
        }
      }
    }
  };

  // Sync block content on input
  const handleBlockInput = (bIdx: number, block: DocNode) => {
    const el = blockRefs.current[bIdx];
    if (!el) return;

    const newInline = domToInlineContent(el);
    const updatedContent = [...doc.content];

    if (block.type === 'bulletList' || block.type === 'orderedList') {
      const items = block.content ? [...block.content] : [];
      if (items.length > 0) {
        items[0] = {
          ...items[0],
          content: [{ type: 'paragraph', content: newInline }],
        };
      } else {
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: newInline }],
        });
      }
      updatedContent[bIdx] = { ...block, content: items };
    } else {
      updatedContent[bIdx] = { ...block, content: newInline };
    }

    updateDoc({ ...doc, content: updatedContent }, false);
  };

  // Paste handler: Sanitizes pasted plain text/html, avoids XSS
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    // Insert clean text safely at cursor
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    }

    // Trigger update
    if (focusedBlockIndex !== null) {
      const el = blockRefs.current[focusedBlockIndex];
      if (el) {
        handleBlockInput(focusedBlockIndex, doc.content[focusedBlockIndex]);
      }
    }
  };

  // Active block format detection
  const activeBlock = focusedBlockIndex !== null ? doc.content[focusedBlockIndex] : null;
  const currentBlockType = useMemo(() => {
    if (!activeBlock) return 'paragraph';
    if (activeBlock.type === 'heading') {
      return `heading-${activeBlock.attrs?.level || 1}`;
    }
    return activeBlock.type;
  }, [activeBlock]);
  const recoveryMatchesCurrentRevision = recoveryDraft?.baseRevision === revision;

  return (
    <div
      ref={editorContainerRef}
      onKeyDown={handleEditorKeyDown}
      onBlur={flushPendingSave}
      className={`flex flex-col w-full rounded-lg border border-[#24252c] bg-[#0e0f13] text-[#ececf1] overflow-hidden shadow-2xl transition-all ${className}`}
    >
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121318] border-b border-[#202127]">
        {/* Document Title Input */}
        <div className="flex-1 mr-4">
          <input
            type="text"
            value={title}
            aria-label={t('knowledge.editor.documentTitle')}
            disabled={isReadOnly}
            onChange={(e) => {
              titleRef.current = e.target.value;
              setTitle(e.target.value);
              onTitleChange?.(e.target.value);
              stageSnapshot(docRef.current, e.target.value);
            }}
            placeholder={t('knowledge.editor.documentTitle')}
            className="w-full bg-transparent text-sm font-semibold text-[#f4f4f5] placeholder-[#545660] outline-none border-0 tracking-tight"
          />
        </div>

        {/* Status Indicators & Metadata */}
        <div className="flex items-center gap-3">
          {/* Word / Char Count */}
          <span className="hidden sm:inline font-mono text-[10px] text-[#71717a]">
            {wordCount} {tx("words ·")} {charCount} {tx("chars")}</span>

          {/* Revision */}
          <span className="hidden sm:inline font-mono text-[9px] text-[#545660] px-1.5 py-0.5 rounded bg-[#181920] border border-[#26272e]">
            {tx("rev")} {revision}
          </span>

          {/* Autosave Status Badge */}
          <div className="flex items-center">
            {saveStatus === 'saved' && (
              <div
                title={lastSavedTime ? `Last saved at ${lastSavedTime}` : 'All changes saved'}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#142318] border border-[#224429] text-[#4ade80] text-[10px] font-medium"
              >
                <Check size={11} className="stroke-[2.5]" />
                <span>{t('knowledge.editor.saved')}</span>
              </div>
            )}

            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#1f1d2b] border border-[#3c3454] text-[#a58afa] text-[10px] font-medium">
                <Loader2 size={11} className="animate-spin" />
                <span>{t('knowledge.editor.saving')}</span>
              </div>
            )}

            {saveStatus === 'unsaved' && (
              <button
                type="button"
                onClick={() => recoveryDraft ? restoreRecoveredDraft() : flushPendingSave()}
                title={tx("Click to save now (Ctrl+S)")}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#271f14] border border-[#4d381c] text-[#f59e0b] text-[10px] font-medium cursor-pointer hover:bg-[#34291a] transition-colors"
              >
                <CircleDot size={10} className="animate-pulse" />
                <span>{t('knowledge.editor.unsaved')}</span>
              </button>
            )}

            {saveStatus === 'error' && (
              <div title={saveError || undefined} role="status" aria-live="polite" className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2a1619] border border-[#4d2229] text-[#ef4444] text-[10px] font-medium">
                <AlertCircle size={11} />
                <span>{t('knowledge.editor.failed')}</span>
                {saveError && <span className="sr-only">{saveError}</span>}
                <button
                  type="button"
                  onClick={() => performSave()}
                  className="underline hover:text-white transition-colors ml-0.5 font-bold"
                >
                  {t('knowledge.editor.retry')}
                </button>
              </div>
            )}
            {saveStatus === 'conflict' && (
              <div title={saveError || t('knowledge.editor.conflictHelp')} role="alert" aria-live="assertive" className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2a1619] border border-[#4d2229] text-[#ef4444] text-[10px] font-medium">
                <AlertCircle size={11} />
                <span>{t('knowledge.editor.conflict')}</span>
                <button
                  type="button"
                  onClick={copyPendingDraft}
                  className="underline hover:text-white transition-colors ml-0.5 font-bold"
                >
                  {t('knowledge.editor.copyDraft')}
                </button>
                {saveError && <span className="sr-only">{saveError}</span>}
                <button
                  type="button"
                  onClick={downloadPendingDraft}
                  className="underline hover:text-white transition-colors ml-0.5 font-bold"
                >
                  {t('knowledge.editor.downloadDraft')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {recoveryDraft && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-[#5b4722] bg-[#271f14] px-4 py-2 text-xs text-[#f2c879]">
          <span>
            {recoveryMatchesCurrentRevision
              ? t('knowledge.editor.recoveryAvailable')
              : t('knowledge.editor.recoveryConflict')}
          </span>
          <div className="flex items-center gap-3">
            {recoveryMatchesCurrentRevision && (
              <button type="button" onClick={restoreRecoveredDraft} className="font-semibold underline hover:text-white">
                {t('knowledge.editor.restoreDraft')}
              </button>
            )}
            <button
              type="button"
              onClick={() => void copyRecoveredDraft(`${recoveryDraft.title}\n\n${recoveryDraft.plainText}`)}
              className="font-semibold underline hover:text-white"
            >
              {t('knowledge.editor.copyDraft')}
            </button>
            <button type="button" onClick={() => downloadDraft(recoveryDraft)} className="font-semibold underline hover:text-white">
              {t('knowledge.editor.downloadDraft')}
            </button>
            <button type="button" onClick={() => setRecoveryDraft(null)} className="underline hover:text-white">
              {t('knowledge.editor.dismiss')}
            </button>
          </div>
        </div>
      )}

      {noteId && draftStorageMode !== 'local' && (
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-[#5b4722] bg-[#271f14] px-4 py-2 text-xs text-[#f2c879]"
        >
          <span>{t(draftStorageMode === 'session' ? 'knowledge.editor.recoverySessionOnly' : 'knowledge.editor.recoveryUnavailable')}</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={copyPendingDraft} className="font-semibold underline hover:text-white">
              {t('knowledge.editor.copyDraft')}
            </button>
            <button type="button" onClick={downloadPendingDraft} className="font-semibold underline hover:text-white">
              {t('knowledge.editor.downloadDraft')}
            </button>
          </div>
        </div>
      )}

      {/* Top Formatting Toolbar */}
      {!isReadOnly && (
        <EditorToolbar
          canUndo={history.past.length > 0}
          canRedo={history.future.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          activeBlockType={currentBlockType}
          activeMarks={activeMarks}
          onToggleMark={handleToggleMark}
          onSetBlockType={handleSetBlockType}
          onInsertLink={handleInsertLink}
          onInsertTable={handleInsertTable}
          onInsertDivider={handleInsertDivider}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Contextual Bubble Toolbar */}
      {!isReadOnly && (
        <BubbleToolbar
          position={bubblePos}
          activeMarks={activeMarks}
          onToggleMark={handleToggleMark}
          onSetBlockType={handleSetBlockType}
          onInsertLink={handleInsertLink}
          onClose={() => setBubblePos(null)}
        />
      )}

      {/* Slash Commands Menu Popover */}
      {slashMenu && !isReadOnly && (
        <div
          role="menu"
          aria-label={tx("Slash commands")}
          style={{ top: `${slashMenu.coords.top}px`, left: `${slashMenu.coords.left}px` }}
          className="fixed z-50 w-56 rounded-lg border border-[#3f3f46] bg-[#18181b] shadow-2xl p-1 text-xs text-[#d4d4da]"
        >
          <div className="px-2 py-1 text-[10px] text-[#71717a] font-semibold tracking-wider">
            {tx("BASIC BLOCKS")}</div>
          <button
            type="button"
            onClick={() => handleSetBlockType('paragraph')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <span className="w-5 text-center text-[#9798a2]">¶</span> {tx("Text")}</button>
          <button
            type="button"
            onClick={() => handleSetBlockType('heading', { level: 1 })}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <Heading1 size={13} className="text-[#a58afa]" /> {tx("Heading 1")}</button>
          <button
            type="button"
            onClick={() => handleSetBlockType('heading', { level: 2 })}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <Heading2 size={13} className="text-[#a58afa]" /> {tx("Heading 2")}</button>
          <button
            type="button"
            onClick={() => handleSetBlockType('heading', { level: 3 })}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <Heading3 size={13} className="text-[#a58afa]" /> {tx("Heading 3")}</button>
          <button
            type="button"
            onClick={() => handleSetBlockType('taskList')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <CheckSquare size={13} className="text-[#4ade80]" /> {tx("Checklist")}</button>
          <button
            type="button"
            onClick={() => handleSetBlockType('bulletList')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <List size={13} className="text-[#9798a2]" /> {tx("Bullet List")}</button>
          <button
            type="button"
            onClick={() => handleSetBlockType('orderedList')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <ListOrdered size={13} className="text-[#9798a2]" /> {tx("Numbered List")}</button>
          <button
            type="button"
            onClick={() => handleSetBlockType('blockquote')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <Quote size={13} className="text-[#a58afa]" /> {tx("Quote")}</button>
          <button
            type="button"
            onClick={() => handleSetBlockType('codeBlock', { language: 'typescript' })}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <span className="font-mono text-xs text-[#a58afa]">{'</>'}</span> {tx("Code Block")}</button>
          <button
            type="button"
            onClick={() => handleInsertTable(3, 3)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <TableIcon size={13} className="text-[#a58afa]" /> {tx("Table 3×3")}</button>
          <button
            type="button"
            onClick={handleInsertDivider}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#27272a] hover:text-white transition-colors text-left"
          >
            <Minus size={13} className="text-[#71717a]" /> {tx("Divider")}</button>
        </div>
      )}

      {/* Editor Body Area */}
      <div className="flex-1 min-h-[360px] p-6 focus:outline-none overflow-y-auto">
        {doc.content.map((block, bIdx) => {
          // 1. Headings
          if (block.type === 'heading') {
            const level = (typeof block.attrs?.level === 'number' ? block.attrs.level : 1) as 1 | 2 | 3;
            const headingClass =
              level === 1
                ? 'text-2xl font-bold tracking-tight text-[#f4f4f5] my-3 leading-snug'
                : level === 2
                ? 'text-xl font-semibold tracking-tight text-[#e4e4e7] my-2.5 leading-snug'
                : 'text-base font-semibold text-[#d4d4d8] my-2 leading-snug';

            return (
              <div
                key={bIdx}
                ref={(el) => {
                  blockRefs.current[bIdx] = el;
                }}
                contentEditable={!isReadOnly}
                suppressContentEditableWarning
                onFocus={() => setFocusedBlockIndex(bIdx)}
                onInput={() => handleBlockInput(bIdx, block)}
                onKeyDown={(e) => handleBlockKeyDown(e, bIdx, block)}
                onPaste={handlePaste}
                dangerouslySetInnerHTML={{ __html: inlineContentToHTML(block.content) }}
                className={`outline-none transition-colors ${headingClass}`}
                data-placeholder={`Heading ${level}...`}
              />
            );
          }

          // 2. Paragraph
          if (block.type === 'paragraph') {
            return (
              <div
                key={bIdx}
                ref={(el) => {
                  blockRefs.current[bIdx] = el;
                }}
                contentEditable={!isReadOnly}
                suppressContentEditableWarning
                onFocus={() => setFocusedBlockIndex(bIdx)}
                onInput={() => handleBlockInput(bIdx, block)}
                onKeyDown={(e) => handleBlockKeyDown(e, bIdx, block)}
                onPaste={handlePaste}
                dangerouslySetInnerHTML={{ __html: inlineContentToHTML(block.content) }}
                className="outline-none text-[13px] leading-relaxed text-[#d4d4d8] my-1 min-h-[1.5em] transition-colors empty:before:content-[attr(data-placeholder)] empty:before:text-[#454650]"
                data-placeholder={bIdx === 0 ? placeholder : ''}
              />
            );
          }

          // 3. Blockquote
          if (block.type === 'blockquote') {
            return (
              <blockquote
                key={bIdx}
                ref={(el) => {
                  blockRefs.current[bIdx] = el;
                }}
                contentEditable={!isReadOnly}
                suppressContentEditableWarning
                onFocus={() => setFocusedBlockIndex(bIdx)}
                onInput={() => handleBlockInput(bIdx, block)}
                onKeyDown={(e) => handleBlockKeyDown(e, bIdx, block)}
                onPaste={handlePaste}
                dangerouslySetInnerHTML={{ __html: inlineContentToHTML(block.content) }}
                className="outline-none border-l-2 border-[#a58afa] bg-[#1a1726]/40 px-3 py-1.5 my-2.5 italic text-[#c4c4cc] text-[13px] rounded-r transition-colors"
                data-placeholder={tx('Quote...')}
              />
            );
          }

          // 4. Code Block
          if (block.type === 'codeBlock') {
            const lang = typeof block.attrs?.language === 'string' ? block.attrs.language : 'typescript';
            const codeText = block.content?.map((n) => n.text || '').join('') || '';

            return (
              <div
                key={bIdx}
                className="relative my-3 rounded-lg border border-[#27272a] bg-[#090a0d] overflow-hidden text-xs"
              >
                {/* Code Header Bar */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#14151b] border-b border-[#202127]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#a58afa] font-bold">{'</>'}</span>
                    {!isReadOnly ? (
                      <select
                        value={lang}
                        onChange={(e) => {
                          const updated = [...doc.content];
                          updated[bIdx] = {
                            ...block,
                            attrs: { ...block.attrs, language: e.target.value },
                          };
                          updateDoc({ ...doc, content: updated });
                        }}
                        className="bg-transparent text-[11px] font-mono text-[#9798a2] outline-none cursor-pointer hover:text-white"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l} value={l} className="bg-[#18181b] text-[#ececf1]">
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono text-[10px] text-[#9798a2] uppercase">{lang}</span>
                    )}
                  </div>

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={() => handleCopyCode(bIdx, codeText)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#868792] hover:text-white hover:bg-[#202128] transition-colors"
                  >
                    {copiedIndex === bIdx ? (
                      <>
                        <CheckCheck size={11} className="text-[#4ade80]" />
                        <span className="text-[#4ade80]">{tx("Copied!")}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>{tx("Copy")}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Code Editor Content */}
                <div className="p-3 overflow-x-auto">
                  {isReadOnly ? (
                    <pre className="font-mono text-xs text-[#a5a5af] leading-relaxed m-0 whitespace-pre">
                      {codeText}
                    </pre>
                  ) : (
                    <textarea
                      value={codeText}
                      onChange={(e) => {
                        const updated = [...doc.content];
                        updated[bIdx] = {
                          ...block,
                          content: [{ type: 'text', text: e.target.value }],
                        };
                        updateDoc({ ...doc, content: updated });
                      }}
                      onFocus={() => setFocusedBlockIndex(bIdx)}
                      rows={Math.max(2, codeText.split('\n').length)}
                      placeholder={tx('// Write code here...')}
                      className="w-full bg-transparent font-mono text-xs text-[#d1d1dc] outline-none resize-none leading-relaxed"
                    />
                  )}
                </div>
              </div>
            );
          }

          // 5. Task List / Checklist
          if (block.type === 'taskList') {
            const items = block.content || [];
            return (
              <div key={bIdx} className="my-2 space-y-1.5">
                {items.map((item, itmIdx) => {
                  const isChecked = item.attrs?.checked || false;
                  const paragraphNode = item.content?.[0];
                  const itemInline = paragraphNode?.content || [];

                  return (
                    <div key={itmIdx} className="flex items-start gap-2.5 group">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => handleToggleTask(bIdx, itmIdx)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                          isChecked
                            ? 'bg-[#9878e8] border-[#a68afa] text-[#121217]'
                            : 'bg-[#14151a] border-[#3f3f46] hover:border-[#a58afa]'
                        }`}
                      >
                        {isChecked && <Check size={11} className="stroke-[3]" />}
                      </button>

                      <div
                        contentEditable={!isReadOnly}
                        suppressContentEditableWarning
                        onFocus={() => setFocusedBlockIndex(bIdx)}
                        onKeyDown={(e) => handleBlockKeyDown(e, bIdx, block)}
                        onPaste={handlePaste}
                        onInput={(e) => {
                          const newNodes = domToInlineContent(e.currentTarget);
                          const updated = [...doc.content];
                          const curItems = [...(block.content || [])];
                          curItems[itmIdx] = {
                            ...curItems[itmIdx],
                            content: [{ type: 'paragraph', content: newNodes }],
                          };
                          updated[bIdx] = { ...block, content: curItems };
                          updateDoc({ ...doc, content: updated }, false);
                        }}
                        dangerouslySetInnerHTML={{ __html: inlineContentToHTML(itemInline) }}
                        className={`flex-1 outline-none text-[13px] leading-snug transition-colors ${
                          isChecked ? 'line-through text-[#6e6f7a]' : 'text-[#d4d4d8]'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            );
          }

          // 6. Bullet List
          if (block.type === 'bulletList') {
            const items = block.content || [];
            return (
              <ul key={bIdx} className="list-disc pl-5 my-2 space-y-1 text-[13px] text-[#d4d4d8]">
                {items.map((item, itmIdx) => {
                  const pNode = item.content?.[0];
                  return (
                    <li
                      key={itmIdx}
                      ref={(el) => {
                        if (itmIdx === 0) blockRefs.current[bIdx] = el;
                      }}
                      contentEditable={!isReadOnly}
                      suppressContentEditableWarning
                      onFocus={() => setFocusedBlockIndex(bIdx)}
                      onInput={() => handleBlockInput(bIdx, block)}
                      onKeyDown={(e) => handleBlockKeyDown(e, bIdx, block)}
                      onPaste={handlePaste}
                      dangerouslySetInnerHTML={{ __html: inlineContentToHTML(pNode?.content) }}
                      className="outline-none leading-relaxed"
                    />
                  );
                })}
              </ul>
            );
          }

          // 7. Ordered List
          if (block.type === 'orderedList') {
            const items = block.content || [];
            return (
              <ol key={bIdx} className="list-decimal pl-5 my-2 space-y-1 text-[13px] text-[#d4d4d8]">
                {items.map((item, itmIdx) => {
                  const pNode = item.content?.[0];
                  return (
                    <li
                      key={itmIdx}
                      ref={(el) => {
                        if (itmIdx === 0) blockRefs.current[bIdx] = el;
                      }}
                      contentEditable={!isReadOnly}
                      suppressContentEditableWarning
                      onFocus={() => setFocusedBlockIndex(bIdx)}
                      onInput={() => handleBlockInput(bIdx, block)}
                      onKeyDown={(e) => handleBlockKeyDown(e, bIdx, block)}
                      onPaste={handlePaste}
                      dangerouslySetInnerHTML={{ __html: inlineContentToHTML(pNode?.content) }}
                      className="outline-none leading-relaxed"
                    />
                  );
                })}
              </ol>
            );
          }

          // 8. Table Block
          if (block.type === 'table') {
            return (
              <TableEditor
                key={bIdx}
                node={block}
                isReadOnly={isReadOnly}
                onChange={(updatedTable) => {
                  const updated = [...doc.content];
                  updated[bIdx] = updatedTable;
                  updateDoc({ ...doc, content: updated });
                }}
                onDelete={() => {
                  const updated = doc.content.filter((_, i) => i !== bIdx);
                  updateDoc({
                    ...doc,
                    content: updated.length > 0 ? updated : [{ type: 'paragraph', content: [] }],
                  });
                }}
              />
            );
          }

          // 9. Horizontal Rule
          if (block.type === 'horizontalRule') {
            return (
              <div key={bIdx} className="my-5 relative group flex items-center">
                <hr className="w-full border-t border-[#27272a]" />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = doc.content.filter((_, i) => i !== bIdx);
                      updateDoc({ ...doc, content: updated });
                    }}
                    title={tx("Remove divider")}
                    className="absolute right-0 opacity-0 group-hover:opacity-100 p-1 text-[#71717a] hover:text-[#ef4444] rounded bg-[#18181b] border border-[#27272a] transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Editor Quick Action Footer */}
      {!isReadOnly && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#0c0d10] border-t border-[#1e1f26] text-[11px] text-[#60616c]">
          <div className="flex items-center gap-2">
            <span>{tx("Type")} <kbd className="px-1.5 py-0.5 rounded bg-[#181920] border border-[#27272a] text-[#a58afa] font-mono text-[9px]">/</kbd> {tx("for block commands")}</span>
            <span>·</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[#181920] border border-[#27272a] font-mono text-[9px]">Ctrl+B</kbd> {tx("Bold")}</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[#181920] border border-[#27272a] font-mono text-[9px]">Ctrl+I</kbd> {tx("Italic")}</span>
            <span><kbd className="px-1 py-0.5 rounded bg-[#181920] border border-[#27272a] font-mono text-[9px]">Ctrl+S</kbd> {tx("Save")}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSetBlockType('paragraph')}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#1a1b22] text-[#868792] hover:text-[#e4e3e9] transition-colors"
            >
              <Plus size={12} />
              <span>{tx("Add Block")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
