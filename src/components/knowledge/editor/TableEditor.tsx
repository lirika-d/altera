import React, { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Table as TableIcon,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
} from 'lucide-react';
import type { DocNode } from './editorTypes';
import { useTranslation } from '@/i18n'

export interface TableEditorProps {
  node: DocNode;
  onChange: (updatedNode: DocNode) => void;
  onDelete: () => void;
  isReadOnly?: boolean;
}

/**
 * Extracts plain text from a cell's paragraph content
 */
function getCellPlainText(cell?: DocNode): string {
  if (!cell || !cell.content) return '';
  const textParts: string[] = [];
  for (const block of cell.content) {
    if (block.content) {
      for (const t of block.content) {
        if (t.text) textParts.push(t.text);
      }
    }
  }
  return textParts.join(' ');
}

/**
 * Creates a table cell with the provided text
 */
function createCell(isHeader: boolean, text = ''): DocNode {
  return {
    type: isHeader ? 'tableHeader' : 'tableCell',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  };
}

export const TableEditor: React.FC<TableEditorProps> = ({
  node,
  onChange,
  onDelete,
  isReadOnly = false,
}) => {
  const { tx } = useTranslation()
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const rows = node.content || [];
  const rowCount = rows.length;
  const colCount = rowCount > 0 && rows[0].content ? rows[0].content.length : 0;

  // Handle cell text change
  const handleCellChange = (rIndex: number, cIndex: number, newText: string) => {
    const updatedRows = rows.map((row, r) => {
      if (r !== rIndex) return row;
      const cells = row.content ? [...row.content] : [];
      const isHeader = cells[cIndex]?.type === 'tableHeader';
      cells[cIndex] = createCell(isHeader, newText);
      return { ...row, content: cells };
    });

    onChange({
      ...node,
      content: updatedRows,
    });
  };

  // Add Row Above or Below
  const handleAddRow = (position: 'above' | 'below') => {
    const targetRow = activeCell ? activeCell.r : rowCount - 1;
    const insertIdx = position === 'above' ? targetRow : targetRow + 1;

    const newCells: DocNode[] = [];
    for (let c = 0; c < colCount; c++) {
      newCells.push(createCell(false, ''));
    }

    const newRow: DocNode = {
      type: 'tableRow',
      content: newCells,
    };

    const updatedRows = [...rows];
    updatedRows.splice(insertIdx, 0, newRow);

    onChange({
      ...node,
      content: updatedRows,
    });

    setActiveCell({ r: insertIdx, c: activeCell?.c || 0 });
  };

  // Delete Current Row
  const handleDeleteRow = () => {
    if (rowCount <= 1) {
      onDelete();
      return;
    }
    const targetRow = activeCell ? activeCell.r : rowCount - 1;
    const updatedRows = rows.filter((_, i) => i !== targetRow);

    onChange({
      ...node,
      content: updatedRows,
    });

    const newR = Math.max(0, Math.min(targetRow, updatedRows.length - 1));
    setActiveCell({ r: newR, c: activeCell?.c || 0 });
  };

  // Add Column Left or Right
  const handleAddColumn = (position: 'left' | 'right') => {
    const targetCol = activeCell ? activeCell.c : colCount - 1;
    const insertIdx = position === 'left' ? targetCol : targetCol + 1;

    const updatedRows = rows.map((row, r) => {
      const cells = row.content ? [...row.content] : [];
      const isHeader = r === 0 && cells[0]?.type === 'tableHeader';
      cells.splice(insertIdx, 0, createCell(isHeader, ''));
      return { ...row, content: cells };
    });

    onChange({
      ...node,
      content: updatedRows,
    });

    setActiveCell({ r: activeCell?.r || 0, c: insertIdx });
  };

  // Delete Current Column
  const handleDeleteColumn = () => {
    if (colCount <= 1) {
      onDelete();
      return;
    }
    const targetCol = activeCell ? activeCell.c : colCount - 1;
    const updatedRows = rows.map((row) => {
      const cells = row.content ? [...row.content] : [];
      cells.splice(targetCol, 1);
      return { ...row, content: cells };
    });

    onChange({
      ...node,
      content: updatedRows,
    });

    const newC = Math.max(0, Math.min(targetCol, colCount - 2));
    setActiveCell({ r: activeCell?.r || 0, c: newC });
  };

  // Toggle Header Row
  const handleToggleHeader = () => {
    if (rowCount === 0) return;
    const firstRow = rows[0];
    const isCurrentlyHeader = firstRow.content?.[0]?.type === 'tableHeader';
    const newType = isCurrentlyHeader ? 'tableCell' : 'tableHeader';

    const updatedRows = rows.map((row, r) => {
      if (r !== 0) return row;
      const cells = (row.content || []).map((cell) => ({
        ...cell,
        type: newType as 'tableHeader' | 'tableCell',
      }));
      return { ...row, content: cells };
    });

    onChange({
      ...node,
      content: updatedRows,
    });
  };

  // Keyboard Navigation: Tab / Shift+Tab to jump between cells
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rIndex: number,
    cIndex: number
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Navigate backwards
        if (cIndex > 0) {
          setActiveCell({ r: rIndex, c: cIndex - 1 });
        } else if (rIndex > 0) {
          setActiveCell({ r: rIndex - 1, c: colCount - 1 });
        }
      } else {
        // Navigate forwards
        if (cIndex < colCount - 1) {
          setActiveCell({ r: rIndex, c: cIndex + 1 });
        } else if (rIndex < rowCount - 1) {
          setActiveCell({ r: rIndex + 1, c: 0 });
        } else {
          // Last cell: auto append new row!
          handleAddRow('below');
        }
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Enter navigates to row below or appends
      e.preventDefault();
      if (rIndex < rowCount - 1) {
        setActiveCell({ r: rIndex + 1, c: cIndex });
      } else {
        handleAddRow('below');
      }
    }
  };

  return (
    <div className="relative my-4 group rounded-md border border-[#27272a] bg-[#101115] overflow-hidden">
      {/* Table Actions Header */}
      {!isReadOnly && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#16171d] border-b border-[#24252c] text-xs text-[#858591]">
          <div className="flex items-center gap-2">
            <TableIcon size={14} className="text-[#a58afa]" />
            <span className="font-mono text-[10px] text-[#9798a2]">
              {tx("Table (")}{rowCount}×{colCount})
            </span>
            {activeCell && (
              <span className="text-[10px] text-[#60616c] font-mono">
                [R{activeCell.r + 1}:C{activeCell.c + 1}]
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleAddRow('below')}
              title={tx("Add row below")}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#202128] hover:text-[#e4e3e9] transition-colors"
            >
              <Plus size={12} />
              <span>{tx("Row")}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddColumn('right')}
              title={tx("Add column right")}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#202128] hover:text-[#e4e3e9] transition-colors"
            >
              <Plus size={12} />
              <span>{tx("Col")}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#202128] hover:text-[#e4e3e9] transition-colors"
              >
                <span>{tx("Actions")}</span>
                <ChevronDown size={11} />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 rounded-md border border-[#3f3f46] bg-[#18181b] shadow-xl z-20 py-1 text-[11px]"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleAddRow('above');
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#27272a] text-left text-[#d4d4da]"
                  >
                    <ArrowUp size={12} /> {tx("Add row above")}</button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAddRow('below');
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#27272a] text-left text-[#d4d4da]"
                  >
                    <ArrowDown size={12} /> {tx("Add row below")}</button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAddColumn('left');
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#27272a] text-left text-[#d4d4da]"
                  >
                    <ArrowLeft size={12} /> {tx("Add column left")}</button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAddColumn('right');
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#27272a] text-left text-[#d4d4da]"
                  >
                    <Plus size={12} /> {tx("Add column right")}</button>
                  <div className="my-1 border-t border-[#27272a]" />
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleHeader();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#27272a] text-left text-[#d4d4da]"
                  >
                    {tx("Toggle Header Row")}</button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteRow();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#27272a] text-left text-[#f87171]"
                  >
                    <Trash2 size={12} /> {tx("Delete Row")}</button>
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteColumn();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#27272a] text-left text-[#f87171]"
                  >
                    <Trash2 size={12} /> {tx("Delete Column")}</button>
                  <div className="my-1 border-t border-[#27272a]" />
                  <button
                    type="button"
                    onClick={() => {
                      onDelete();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#3f1d24] text-left text-[#ef4444]"
                  >
                    <Trash2 size={12} /> {tx("Remove Table")}</button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onDelete}
              title={tx("Delete table")}
              className="p-1 rounded text-[#71717a] hover:text-[#ef4444] hover:bg-[#271d20] transition-colors ml-1"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto w-full">
        <table ref={tableRef} className="w-full border-collapse text-xs">
          <tbody>
            {rows.map((row, rIdx) => {
              const cells = row.content || [];
              return (
                <tr key={rIdx} className="border-b border-[#24252c] last:border-b-0">
                  {cells.map((cell, cIdx) => {
                    const isHeader = cell.type === 'tableHeader';
                    const isSelected = activeCell?.r === rIdx && activeCell?.c === cIdx;
                    const textValue = getCellPlainText(cell);

                    return (
                      <td
                        key={cIdx}
                        className={`border-r border-[#24252c] last:border-r-0 p-0 transition-colors ${
                          isHeader
                            ? 'bg-[#14151c] font-semibold text-[#e4e3e9]'
                            : 'bg-[#101115] text-[#d4d4da]'
                        } ${isSelected ? 'ring-1 ring-[#9879f5] z-10' : ''}`}
                      >
                        {isReadOnly ? (
                          <div className="px-3 py-2 min-h-[30px] whitespace-pre-wrap">
                            {textValue || <span className="text-[#454650] italic">—</span>}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={textValue}
                            onFocus={() => setActiveCell({ r: rIdx, c: cIdx })}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                            className="w-full h-full px-3 py-2 bg-transparent text-inherit outline-none border-0 text-xs"
                            placeholder={isHeader ? `Header ${cIdx + 1}` : 'Cell...'}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
