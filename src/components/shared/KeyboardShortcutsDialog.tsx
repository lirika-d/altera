import { useTranslation } from '@/i18n'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const shortcuts = [
  ['mod+k', 'commandPalette'],
  ['mod+shift+enter', 'createTask'],
  ['g w', 'workspace'],
  ['g p', 'projects'],
  ['g c', 'calendar'],
  ['g i', 'insights'],
  ['?', 'help'],
] as const

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const { t } = useTranslation()
  const modifier = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('keyboard.title')}</DialogTitle>
          <DialogDescription>{t('keyboard.description')}</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border-subtle">
          {shortcuts.map(([key, label]) => {
            const shownKey = key.replace('mod', modifier).replace('shift', 'Shift').replace('enter', 'Enter')
            return <div key={label} className="flex min-h-10 items-center justify-between gap-4 py-2">
              <dt className="text-xs text-text-secondary">{t(`keyboard.actions.${label}`)}</dt>
              <dd><kbd className="rounded border border-border bg-bg-base px-2 py-1 font-mono text-[11px] text-text-primary">{shownKey}</kbd></dd>
            </div>
          })}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
