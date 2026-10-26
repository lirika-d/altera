import { useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  collapsed?: boolean
  className?: string
}

export function LanguageSwitcher({ collapsed = false, className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const current = i18n.language

  const toggle = () => {
    i18n.changeLanguage(current === 'ru' ? 'en' : 'ru')
  }

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        type="button"
        title={current === 'ru' ? 'Switch to English' : 'Переключить на русский'}
        className={cn(
          'flex h-6 w-7 mx-auto items-center justify-center rounded text-[11px] font-mono font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors border border-border-subtle select-none',
          className
        )}
      >
        {current.toUpperCase()}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded border border-border-subtle bg-bg-base/70 p-0.5 select-none',
        className
      )}
    >
      <button
        type="button"
        onClick={() => i18n.changeLanguage('ru')}
        className={cn(
          'flex items-center justify-center h-6 px-2 rounded-[3px] text-[11px] font-mono font-medium transition-colors',
          current === 'ru'
            ? 'bg-accent-olive/20 text-accent-olive border border-accent-olive/30 shadow-xs'
            : 'text-text-muted hover:text-text-primary'
        )}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => i18n.changeLanguage('en')}
        className={cn(
          'flex items-center justify-center h-6 px-2 rounded-[3px] text-[11px] font-mono font-medium transition-colors',
          current === 'en'
            ? 'bg-accent-olive/20 text-accent-olive border border-accent-olive/30 shadow-xs'
            : 'text-text-muted hover:text-text-primary'
        )}
      >
        EN
      </button>
    </div>
  )
}
