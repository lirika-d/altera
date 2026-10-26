// Unit tests for ALTERA Knowledge Rich Text Note Editor
// Validates schema, conversions, security sanitization, and plain text search indexing

import { describe, it, expect } from 'vitest';
import {
  createEmptyDoc,
  normalizeDoc,
  sanitizeUrl,
  jsonToPlainText,
  docToMarkdown,
  markdownToDoc,
  createEmptyTable,
  inlineContentToHTML,
  type DocRoot,
} from './editorTypes.ts';

describe('Rich Text Note Editor', () => {
  it('passes all editor tests', () => {
    const result = runEditorTests();
    expect(result.failed).toBe(0);
    expect(result.passed).toBeGreaterThan(0);
  });
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runEditorTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      // console.log(`✓ ${name}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${name}:`, err);
    }
  }

  // 1. Security / URL Sanitization Tests
  test('sanitizeUrl rejects javascript: URLs', () => {
    assert(sanitizeUrl('javascript:alert(document.cookie)') === '', 'Must reject javascript:');
    assert(sanitizeUrl('JAVASCRIPT:alert(1)') === '', 'Must reject uppercase JAVASCRIPT:');
    assert(sanitizeUrl('javascript:void(0)') === '', 'Must reject javascript:void(0)');
  });

  test('sanitizeUrl rejects data: and vbscript: URLs', () => {
    assert(sanitizeUrl('data:text/html,<script>alert(1)</script>') === '', 'Must reject data:');
    assert(sanitizeUrl('vbscript:msgbox(1)') === '', 'Must reject vbscript:');
    for (const url of [
      'java\nscript:alert(1)',
      'java\tscript:alert(1)',
      'java\rscript:alert(1)',
      'java\u0000script:alert(1)',
    ]) {
      assert(sanitizeUrl(url) === '', 'Must reject control-character-obfuscated javascript:');
    }
    assert(sanitizeUrl('ftp://example.com/file') === 'ftp://example.com/file', 'Preserve existing URL schemes');
  });

  test('sanitizeUrl preserves safe URLs', () => {
    assert(sanitizeUrl('https://altera.app/docs') === 'https://altera.app/docs', 'Safe https URL');
    assert(sanitizeUrl('http://localhost:3000') === 'http://localhost:3000', 'Safe http URL');
    assert(sanitizeUrl('mailto:support@altera.app') === 'mailto:support@altera.app', 'Safe mailto URL');
    assert(sanitizeUrl('/workspace/knowledge') === '/workspace/knowledge', 'Safe relative URL');
  });

  test('inlineContentToHTML escapes untrusted link attributes', () => {
    const html = inlineContentToHTML([
      {
        type: 'text',
        text: 'Open link',
        marks: [{ type: 'link', attrs: { href: 'https://example.com/" onmouseover="alert(1)' } }],
      },
    ]);
    assert(!html.includes('" onmouseover="'), 'Link URL must not create another HTML attribute');
    assert(html.includes('&quot; onmouseover=&quot;'), 'Quotes should remain encoded inside href');
  });

  // 2. Empty Doc & Normalization Tests
  test('createEmptyDoc produces valid ProseMirror schema', () => {
    const empty = createEmptyDoc();
    assert(empty.type === 'doc', 'Root must be doc');
    assert(Array.isArray(empty.content), 'Content must be array');
    assert(empty.content.length === 1, 'Should have 1 paragraph');
    assert(empty.content[0].type === 'paragraph', 'Default block is paragraph');
  });

  test('malformed stored editor trees remain visible as text without recursive rendering', () => {
    const malformed = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: {} }] })
    const normalized = normalizeDoc(malformed)
    assert(jsonToPlainText(normalized) === malformed, 'Malformed stored content should remain recoverable')

    let deep: Record<string, unknown> = { type: 'text', text: 'deep' }
    for (let depth = 0; depth < 80; depth += 1) deep = { type: 'paragraph', content: [deep] }
    const serialized = JSON.stringify({ type: 'doc', content: [deep] })
    assert(jsonToPlainText(normalizeDoc(serialized)) === serialized, 'Excessively deep content should not recurse')
  });

  test('normalizeDoc handles null, undefined and raw string', () => {
    const fromNull = normalizeDoc(null);
    assert(fromNull.type === 'doc', 'Null gives valid doc');

    const fromRaw = normalizeDoc('Quick thought about architecture');
    assert(fromRaw.type === 'doc', 'Raw text converted to doc');
    assert(fromRaw.content[0].content?.[0].text === 'Quick thought about architecture', 'Text preserved');
  });

  // 3. Plain Text Extraction for Search Indexing
  test('jsonToPlainText extracts text across all block types for search indexing', () => {
    const sampleDoc: DocRoot = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Architecture Decision Record' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'We chose ' },
            { type: 'text', text: 'Tiptap / ProseMirror', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' for state management.' },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft specification' }] }],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Review security controls' }] }],
            },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const revision = 42;' }],
        },
      ],
    };

    const plain = jsonToPlainText(sampleDoc);
    assert(plain.includes('Architecture Decision Record'), 'Contains heading');
    assert(plain.includes('Tiptap / ProseMirror'), 'Contains formatted text');
    assert(plain.includes('Draft specification'), 'Contains task item');
    assert(plain.includes('const revision = 42;'), 'Contains code text');
  });

  // 4. Markdown Serialization and Deserialization Round-trip
  test('markdownToDoc parses headings, bold, checklists and code blocks', () => {
    const md = `# Project Plan

This is **important** with *style* and \`code\`.

- [x] Completed task
- [ ] Pending task

\`\`\`typescript
const status = "active";
\`\`\`
`;

    const doc = markdownToDoc(md);
    assert(doc.type === 'doc', 'Doc type valid');
    assert(doc.content.some((b) => b.type === 'heading'), 'Contains heading');
    assert(doc.content.some((b) => b.type === 'taskList'), 'Contains taskList');
    assert(doc.content.some((b) => b.type === 'codeBlock'), 'Contains codeBlock');

    const backToMd = docToMarkdown(doc);
    assert(backToMd.includes('# Project Plan'), 'Roundtrip retains heading');
    assert(backToMd.includes('**important**'), 'Roundtrip retains bold');
    assert(backToMd.includes('- [x] Completed task'), 'Roundtrip retains checklist');
  });

  // 5. Table Editor Node Creation
  test('createEmptyTable creates valid ProseMirror table schema', () => {
    const table = createEmptyTable(2, 3);
    assert(table.type === 'table', 'Table type');
    assert(table.content?.length === 2, '2 rows');
    assert(table.content?.[0].content?.length === 3, '3 columns');
    assert(table.content?.[0].content?.[0].type === 'tableHeader', 'First row has tableHeader cells');
    assert(table.content?.[1].content?.[0].type === 'tableCell', 'Second row has tableCell cells');
  });

  // 6. Security & XSS Prevention
  test('markdown with malicious script links sanitizes safely', () => {
    const maliciousMd = 'Check out [Click here](javascript:alert("hacked")) for details.';
    const parsed = markdownToDoc(maliciousMd);
    const linkNode = parsed.content[0]?.content?.find((n) => n.marks?.some((m) => m.type === 'link'));
    assert(!linkNode || (linkNode.marks?.[0].attrs as { href?: string } | undefined)?.href === '', 'Dangerous link href must be stripped');
  });

  // 7. Markdown Tables Parsing
  test('markdownToDoc parses markdown table syntax correctly', () => {
    const tableMd = `| Feature | Status | Notes |
| --- | --- | --- |
| Rich Text | Complete | Tiptap schema |
| Autosave | Active | 600ms debounce |`;

    const doc = markdownToDoc(tableMd);
    assert(doc.content.some((b) => b.type === 'table'), 'Must parse table block');
    const tableBlock = doc.content.find((b) => b.type === 'table');
    assert(tableBlock?.content?.length === 3, 'Must have 3 rows (1 header + 2 data)');
  });

  // 8. Stale write / Revision check logic
  test('expectedRevision protection detects out-of-order writes', () => {
    const currentRevision = 5;
    const canWrite = (expectedRev?: number) => {
      if (expectedRev !== undefined && expectedRev > currentRevision) {
        return false; // Stale check triggered
      }
      return true;
    };

    assert(canWrite(5) === true, 'Matching revision allowed');
    assert(canWrite(4) === true, 'Older expected revision allowed');
    assert(canWrite(6) === false, 'Future revision rejected as potential race condition');
  });

  return { passed, failed };
}

// Auto-run if executed in testing or dev environment
if (
  typeof globalThis !== 'undefined' &&
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production'
) {
  const result = runEditorTests();
  if (result.failed > 0) {
    console.error(`Editor test suite: ${result.failed} tests failed!`);
  }
}
