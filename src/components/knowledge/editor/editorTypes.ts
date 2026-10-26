// Document tree types and conversions for ALTERA Rich Text Note Editor
// ProseMirror / Tiptap compatible schema
import { isValidNoteDocument } from '@/lib/noteDocumentValidation'

export type TextMarkType = 'bold' | 'italic' | 'strike' | 'code' | 'link';

export interface LinkMarkAttrs {
  href: string;
  target?: string;
  rel?: string;
}

export interface TextMark {
  type: TextMarkType;
  attrs?: LinkMarkAttrs | Record<string, unknown>;
}

export interface TextNode {
  type: 'text';
  text: string;
  marks?: TextMark[];
}

export type DocBlockType =
  | 'paragraph'
  | 'heading'
  | 'blockquote'
  | 'codeBlock'
  | 'bulletList'
  | 'orderedList'
  | 'listItem'
  | 'taskList'
  | 'taskItem'
  | 'table'
  | 'tableRow'
  | 'tableHeader'
  | 'tableCell'
  | 'horizontalRule';

export interface HeadingAttrs {
  level: 1 | 2 | 3;
}

export interface CodeBlockAttrs {
  language: string;
}

export interface TaskItemAttrs {
  checked: boolean;
}

export interface TableCellAttrs {
  colspan?: number;
  rowspan?: number;
  colwidth?: number[];
}

export interface DocNode {
  type: DocBlockType | 'text';
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: TextMark[];
}

export interface DocRoot {
  type: 'doc';
  content: DocNode[];
}

export type AutosaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict';

export interface NoteEditorProps {
  initialContentJSON?: string | DocRoot;
  title?: string;
  onTitleChange?: (title: string) => void;
  onSave?: (jsonString: string, plainText: string, revision: number, title: string) => Promise<number>;
  onDraftChange?: (expectedRevision: number) => void;
  onDraftSaved?: () => void;
  noteId?: string;
  isReadOnly?: boolean;
  expectedRevision?: number;
  lastSavedAt?: Date | string | null;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Validates and sanitizes a URL.
 * Rejects javascript:, data:, and vbscript: schemes, including variants with
 * embedded ASCII controls that browsers ignore while parsing URLs.
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (typeof url !== 'string' || !url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Browsers ignore ASCII control characters while parsing URLs, so normalize
  // them for scheme detection before rejecting script/data schemes.
  const normalized = Array.from(trimmed)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join('');
  if (/^(?:javascript|data|vbscript):/i.test(normalized)) {
    return '';
  }
  return trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Converts inline editor nodes to HTML with context-escaped text and links. */
export function inlineContentToHTML(nodes?: DocNode[]): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes
    .map((node) => {
      if (node.type !== 'text' || typeof node.text !== 'string' || !node.text) return '';
      let text = escapeHtml(node.text);

      for (const mark of node.marks || []) {
        if (mark.type === 'code') {
          text = `<code>${text}</code>`;
        } else if (mark.type === 'bold') {
          text = `<strong>${text}</strong>`;
        } else if (mark.type === 'italic') {
          text = `<em>${text}</em>`;
        } else if (mark.type === 'strike') {
          text = `<s>${text}</s>`;
        } else if (mark.type === 'link') {
          const href = sanitizeUrl((mark.attrs as { href?: string } | undefined)?.href);
          if (href) {
            text = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
          }
        }
      }
      return text;
    })
    .join('');
}

/**
 * Creates an empty ProseMirror/Tiptap compatible table node
 */
export function createEmptyTable(rows = 3, cols = 3): DocNode {
  const tableRows: DocNode[] = [];

  for (let r = 0; r < rows; r++) {
    const cells: DocNode[] = [];
    const isHeader = r === 0;

    for (let c = 0; c < cols; c++) {
      cells.push({
        type: isHeader ? 'tableHeader' : 'tableCell',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: isHeader ? `Header ${c + 1}` : `Row ${r} Col ${c + 1}`,
              },
            ],
          },
        ],
      });
    }

    tableRows.push({
      type: 'tableRow',
      content: cells,
    });
  }

  return {
    type: 'table',
    content: tableRows,
  };
}

/**
 * Creates an empty ProseMirror/Tiptap document
 */
export function createEmptyDoc(): DocRoot {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [],
      },
    ],
  };
}

/**
 * Safely normalizes input JSON string or DocRoot object into a valid DocRoot
 */
export function normalizeDoc(input?: string | DocRoot | null): DocRoot {
  if (!input) return createEmptyDoc();

  let parsed: unknown = input;
  let parsedJson = false
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
      parsedJson = true
    } catch {
      // If parsing fails, create document with text as initial paragraph
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: input }],
          },
        ],
      };
    }
  }

  if (isValidNoteDocument(parsed)) {
    const candidate = parsed as DocRoot
    if (candidate.content.length === 0) {
      return createEmptyDoc();
    }
    return candidate;
  }

  // Preserve malformed stored JSON visibly as plain text instead of silently
  // replacing it with an empty document on the next save.
  if (typeof input === 'string') {
    const isDocumentRoot = parsedJson && parsed && typeof parsed === 'object' && (parsed as { type?: unknown }).type === 'doc'
    if (!isDocumentRoot) return createEmptyDoc()
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: input }] }] }
  }

  return createEmptyDoc();
}

/**
 * Recursively extracts plain text from a DocRoot, DocNode, or JSON string.
 * Used for full-text search indexing (e.g. Dexie db search).
 */
export function jsonToPlainText(doc: DocRoot | DocNode | string | null | undefined): string {
  if (!doc) return '';

  let root: DocNode | DocRoot;
  if (typeof doc === 'string') {
    try {
      root = JSON.parse(doc);
    } catch {
      return doc.trim();
    }
  } else {
    root = doc;
  }

  const candidate = root && typeof root === 'object' && root.type === 'doc'
    ? root
    : { type: 'doc', content: [root] }
  if (!isValidNoteDocument(candidate)) {
    const isDocumentRoot = root && typeof root === 'object' && root.type === 'doc'
    return typeof doc === 'string' && isDocumentRoot ? doc.trim() : ''
  }

  const parts: string[] = [];

  function traverse(node: DocNode | DocRoot): void {
    if ('text' in node && typeof node.text === 'string') {
      parts.push(node.text);
      return;
    }

    if ('content' in node && Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child);
      }
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'codeBlock' ||
        node.type === 'blockquote' ||
        node.type === 'listItem' ||
        node.type === 'taskItem' ||
        node.type === 'tableRow'
      ) {
        parts.push('\n');
      }
    }
  }

  traverse(candidate as DocRoot);

  return parts
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Converts a structured DocRoot into clean Markdown format
 */
export function docToMarkdown(doc: DocRoot): string {
  if (!doc || !Array.isArray(doc.content)) return '';

  const renderInline = (nodes?: DocNode[]): string => {
    if (!nodes || !nodes.length) return '';
    return nodes
      .map((node) => {
        if (node.type !== 'text' || !node.text) return '';
        let text = node.text;
        const marks = node.marks || [];

        for (const mark of marks) {
          if (mark.type === 'code') {
            text = `\`${text}\``;
          } else if (mark.type === 'bold') {
            text = `**${text}**`;
          } else if (mark.type === 'italic') {
            text = `*${text}*`;
          } else if (mark.type === 'strike') {
            text = `~~${text}~~`;
          } else if (mark.type === 'link') {
            const href = sanitizeUrl((mark.attrs as LinkMarkAttrs)?.href);
            if (href) {
              text = `[${text}](${href})`;
            }
          }
        }
        return text;
      })
      .join('');
  };

  const lines: string[] = [];

  for (const block of doc.content) {
    switch (block.type) {
      case 'heading': {
        const level = (block.attrs?.level as number) || 1;
        const prefix = '#'.repeat(Math.min(Math.max(level, 1), 6));
        lines.push(`${prefix} ${renderInline(block.content)}`);
        break;
      }
      case 'paragraph': {
        lines.push(renderInline(block.content));
        break;
      }
      case 'blockquote': {
        const text = renderInline(block.content);
        const qLines = text.split('\n').map((l) => `> ${l}`);
        lines.push(qLines.join('\n'));
        break;
      }
      case 'codeBlock': {
        const lang = block.attrs?.language || '';
        const code = block.content?.map((n) => n.text || '').join('') || '';
        lines.push(`\`\`\`${lang}\n${code}\n\`\`\``);
        break;
      }
      case 'bulletList': {
        if (block.content) {
          for (const item of block.content) {
            const itemText = item.content ? item.content.map((p) => renderInline(p.content)).join(' ') : '';
            lines.push(`- ${itemText}`);
          }
        }
        break;
      }
      case 'orderedList': {
        if (block.content) {
          block.content.forEach((item, idx) => {
            const itemText = item.content ? item.content.map((p) => renderInline(p.content)).join(' ') : '';
            lines.push(`${idx + 1}. ${itemText}`);
          });
        }
        break;
      }
      case 'taskList': {
        if (block.content) {
          for (const item of block.content) {
            const checked = item.attrs?.checked ? 'x' : ' ';
            const itemText = item.content ? item.content.map((p) => renderInline(p.content)).join(' ') : '';
            lines.push(`- [${checked}] ${itemText}`);
          }
        }
        break;
      }
      case 'horizontalRule': {
        lines.push('---');
        break;
      }
      case 'table': {
        if (block.content && block.content.length > 0) {
          const rows = block.content;
          rows.forEach((row, rowIndex) => {
            const cells = row.content || [];
            const cellTexts = cells.map((cell) => {
              const cellContent = cell.content ? cell.content.map((p) => renderInline(p.content)).join(' ') : '';
              return cellContent.replace(/\|/g, '\\|');
            });
            lines.push(`| ${cellTexts.join(' | ')} |`);

            if (rowIndex === 0) {
              const separator = cells.map(() => '---').join(' | ');
              lines.push(`| ${separator} |`);
            }
          });
        }
        break;
      }
      default: {
        if (block.content) {
          lines.push(renderInline(block.content));
        }
      }
    }
  }

  return lines.join('\n\n');
}

/**
 * Parses markdown into a structured DocRoot adhering to ProseMirror schema
 */
export function markdownToDoc(markdown: string): DocRoot {
  if (!markdown || !markdown.trim()) {
    return createEmptyDoc();
  }

  const rawLines = markdown.split(/\r?\n/);
  const blocks: DocNode[] = [];
  let i = 0;

  const parseInlineMarks = (text: string): DocNode[] => {
    if (!text) return [];

    // Parse links: [label](url)
    // Code: `code`
    // Bold: **bold**
    // Italic: *italic*
    // Strike: ~~strike~~
    const nodes: DocNode[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    const parseSimpleMarks = (segment: string): DocNode[] => {
      const segNodes: DocNode[] = [];
      // Tokenize by inline code, bold, italic, strike
      const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
      let sIdx = 0;
      let sMatch: RegExpExecArray | null;

      while ((sMatch = regex.exec(segment)) !== null) {
        if (sMatch.index > sIdx) {
          segNodes.push({ type: 'text', text: segment.substring(sIdx, sMatch.index) });
        }
        const full = sMatch[0];
        if (full.startsWith('`') && full.endsWith('`')) {
          segNodes.push({
            type: 'text',
            text: full.slice(1, -1),
            marks: [{ type: 'code' }],
          });
        } else if (full.startsWith('**') && full.endsWith('**')) {
          segNodes.push({
            type: 'text',
            text: full.slice(2, -2),
            marks: [{ type: 'bold' }],
          });
        } else if (full.startsWith('*') && full.endsWith('*')) {
          segNodes.push({
            type: 'text',
            text: full.slice(1, -1),
            marks: [{ type: 'italic' }],
          });
        } else if (full.startsWith('~~') && full.endsWith('~~')) {
          segNodes.push({
            type: 'text',
            text: full.slice(2, -2),
            marks: [{ type: 'strike' }],
          });
        }
        sIdx = regex.lastIndex;
      }
      if (sIdx < segment.length) {
        segNodes.push({ type: 'text', text: segment.substring(sIdx) });
      }
      return segNodes;
    };

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        segNodesPush(nodes, parseSimpleMarks(text.substring(lastIdx, match.index)));
      }
      const label = match[1];
      const href = sanitizeUrl(match[2]);
      nodes.push({
        type: 'text',
        text: label,
        marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }],
      });
      lastIdx = linkRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      segNodesPush(nodes, parseSimpleMarks(text.substring(lastIdx)));
    }

    return nodes.length > 0 ? nodes : [{ type: 'text', text }];
  };

  function segNodesPush(target: DocNode[], source: DocNode[]) {
    for (const item of source) {
      target.push(item);
    }
  }

  while (i < rawLines.length) {
    const line = rawLines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: 'codeBlock',
        attrs: { language: lang || 'plaintext' },
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      continue;
    }

    // Horizontal rule
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      blocks.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineMarks(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const qLines: string[] = [];
      while (i < rawLines.length && rawLines[i].startsWith('>')) {
        qLines.push(rawLines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        content: parseInlineMarks(qLines.join(' ')),
      });
      continue;
    }

    // Task list items: - [ ] or - [x]
    if (/^\s*-\s+\[([ xX])\]\s+(.*)$/.test(line)) {
      const taskItems: DocNode[] = [];
      while (i < rawLines.length) {
        const taskMatch = rawLines[i].match(/^\s*-\s+\[([ xX])\]\s+(.*)$/);
        if (!taskMatch) break;
        const checked = taskMatch[1].toLowerCase() === 'x';
        taskItems.push({
          type: 'taskItem',
          attrs: { checked },
          content: [
            {
              type: 'paragraph',
              content: parseInlineMarks(taskMatch[2]),
            },
          ],
        });
        i++;
      }
      blocks.push({
        type: 'taskList',
        content: taskItems,
      });
      continue;
    }

    // Bullet list items
    if (/^\s*[-*]\s+(.*)$/.test(line)) {
      const listItems: DocNode[] = [];
      while (i < rawLines.length) {
        const bMatch = rawLines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!bMatch) break;
        listItems.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: parseInlineMarks(bMatch[1]),
            },
          ],
        });
        i++;
      }
      blocks.push({
        type: 'bulletList',
        content: listItems,
      });
      continue;
    }

    // Ordered list items
    if (/^\s*\d+\.\s+(.*)$/.test(line)) {
      const listItems: DocNode[] = [];
      while (i < rawLines.length) {
        const oMatch = rawLines[i].match(/^\s*\d+\.\s+(.*)$/);
        if (!oMatch) break;
        listItems.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: parseInlineMarks(oMatch[1]),
            },
          ],
        });
        i++;
      }
      blocks.push({
        type: 'orderedList',
        content: listItems,
      });
      continue;
    }

    // Markdown Table
    if (line.includes('|') && line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableRows: DocNode[] = [];
      let isFirstRow = true;
      while (i < rawLines.length && rawLines[i].includes('|') && rawLines[i].trim().startsWith('|')) {
        const current = rawLines[i].trim();
        // Skip separator row | --- | --- |
        if (/^\|(\s*[-:]+[-| :]*)\|$/.test(current)) {
          i++;
          continue;
        }

        const rawCells = current
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        const cellNodes: DocNode[] = rawCells.map((cellText) => ({
          type: isFirstRow ? 'tableHeader' : 'tableCell',
          content: [
            {
              type: 'paragraph',
              content: parseInlineMarks(cellText),
            },
          ],
        }));

        tableRows.push({
          type: 'tableRow',
          content: cellNodes,
        });

        isFirstRow = false;
        i++;
      }

      if (tableRows.length > 0) {
        blocks.push({
          type: 'table',
          content: tableRows,
        });
      }
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    blocks.push({
      type: 'paragraph',
      content: parseInlineMarks(line),
    });
    i++;
  }

  return {
    type: 'doc',
    content: blocks.length > 0 ? blocks : [{ type: 'paragraph', content: [] }],
  };
}
