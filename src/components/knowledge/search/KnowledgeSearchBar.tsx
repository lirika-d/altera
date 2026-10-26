/**
 * KnowledgeSearchBar.tsx — Compact Inline Search Input for Knowledge Hub
 *
 * Implements:
 *   - Instant debounced substring matching (default 150ms)
 *   - Controlled and uncontrolled value modes
 *   - Clear button (X) when query is non-empty
 *   - Keyboard shortcut ('/' to focus when unfocused, Escape to clear/blur)
 *   - Optional filter pills or dropdown toggle (All / Notes / Resources)
 *   - Linear dark styling matching the ALTERA design system
 */

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/i18n'

export interface KnowledgeSearchBarProps {
  value?: string
  defaultValue?: string
  onChange?: (query: string) => void
  onSearch?: (query: string) => void
  onClear?: () => void
  placeholder?: string
  debounceMs?: number
  autoFocus?: boolean
  className?: string
  showShortcut?: boolean
  enableSlashShortcut?: boolean
  filterType?: 'all' | 'notes' | 'resources'
  onFilterChange?: (filter: 'all' | 'notes' | 'resources') => void
  showFilterToggle?: boolean
}

export function KnowledgeSearchBar({
  value: controlledValue,
  defaultValue = '',
  onChange,
  onSearch,
  onClear,
  placeholder = 'Search notes & resources...',
  debounceMs = 150,
  autoFocus = false,
  className,
  showShortcut = true,
  enableSlashShortcut = true,
  filterType = 'all',
  onFilterChange,
  showFilterToggle = false,
}: KnowledgeSearchBarProps) {
  const { tx } = useTranslation()
  const isControlled = controlledValue !== undefined
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const query = isControlled ? controlledValue : uncontrolledValue

  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fire debounced search notification
  const triggerSearch = React.useCallback(
    (nextVal: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        onChange?.(nextVal)
        onSearch?.(nextVal)
      }, debounceMs)
    },
    [debounceMs, onChange, onSearch]
  )

  // Handle local text change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value
    if (!isControlled) {
      setUncontrolledValue(nextVal)
    }
    triggerSearch(nextVal)
  }

  // Handle Clear
  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    if (!isControlled) {
      setUncontrolledValue('')
    }
    onChange?.('')
    onSearch?.('')
    onClear?.()
    inputRef.current?.focus()
  }

  // Handle keydown (Escape to clear, Enter for instant search)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (query) {
        e.preventDefault()
        handleClear()
      } else {
        inputRef.current?.blur()
      }
    } else if (e.key === 'Enter') {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      onChange?.(query)
      onSearch?.(query)
    }
  }

  // Global '/' keyboard shortcut to focus this input when not typing elsewhere
  React.useEffect(() => {
    if (!enableSlashShortcut) return

    const handleGlobalSlash = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const target = e.target as HTMLElement | null
        const tagName = target?.tagName?.toLowerCase()
        const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select'
        const isEditable = target?.isContentEditable

        if (!isInput && !isEditable) {
          e.preventDefault()
          inputRef.current?.focus()
          inputRef.current?.select()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalSlash)
    return () => window.removeEventListener('keydown', handleGlobalSlash)
  }, [enableSlashShortcut])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex items-center flex-1 min-w-[200px] h-8 rounded-md bg-bg-surface border border-border-subtle focus-within:border-accent-blue/50 focus-within:ring-1 focus-within:ring-accent-blue/20 transition-all text-xs">
        <Search className="h-3.5 w-3.5 text-text-muted ml-2.5 mr-2 shrink-0 pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          className="bg-transparent text-text-primary placeholder:text-text-muted text-xs outline-none w-full pr-8"
        />

        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1.5 p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title={tx("Clear search")}
          >
            <X className="h-3 w-3" />
          </button>
        ) : showShortcut ? (
          <kbd className="absolute right-2 text-[10px] font-mono text-text-muted/60 bg-bg-elevated px-1.5 py-0.2 rounded border border-border-subtle select-none pointer-events-none">
            /
          </kbd>
        ) : null}
      </div>

      {showFilterToggle && onFilterChange && (
        <div className="inline-flex rounded-md border border-border-subtle bg-bg-surface p-0.5 text-xs shrink-0">
          {(['all', 'notes', 'resources'] as const).map((filter) => {
            const isActive = filterType === filter
            return (
              <button
                key={filter}
                type="button"
                onClick={() => onFilterChange(filter)}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] capitalize transition-colors',
                  isActive
                    ? 'bg-accent-blue/15 text-accent-blue font-medium'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {filter}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
