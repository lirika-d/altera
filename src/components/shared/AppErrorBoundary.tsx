import * as React from 'react'
import { serializeRecoveryDiagnostics, type RecoveryFailureCode } from './recoveryDiagnostics'
import { useTranslation } from '@/i18n'

export function RecoveryScreen({
  onRetry,
  code = 'DATABASE_INITIALIZATION_FAILED',
}: {
  onRetry: () => void
  code?: RecoveryFailureCode
}) {
  const { t } = useTranslation()
  const exportDiagnostics = () => {
    const blob = new Blob([serializeRecoveryDiagnostics(code)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'altera-diagnostics.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg-base text-text-primary p-8" role="alert">
      <h1 className="text-xl">{t('app.recovery.title')}</h1>
      <p>{t('app.recovery.description')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button className="rounded border px-4 py-2" onClick={onRetry}>{t('app.recovery.retry')}</button>
        <button className="rounded border px-4 py-2" onClick={exportDiagnostics}>{t('app.recovery.exportDiagnostics')}</button>
      </div>
    </main>
  )
}

export function isNetworkChunkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk .+ failed|unable to preload css|failed to preload css/i.test(message)
}

function UpdateRecoveryScreen() {
  const { t } = useTranslation()
  const refresh = () => {
    if (window.confirm(t('app.update.confirmRefresh'))) window.location.reload()
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg-base text-text-primary p-8" role="alertdialog" aria-modal="true" aria-labelledby="update-recovery-title">
      <h1 id="update-recovery-title" className="text-xl">{t('app.update.title')}</h1>
      <p className="max-w-xl text-center text-text-secondary">{t('app.update.description')}</p>
      <button className="rounded border px-4 py-2" onClick={refresh}>{t('app.update.refresh')}</button>
    </main>
  )
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean; chunkUpdate: boolean }> {
  state = { failed: false, chunkUpdate: false }
  private chunkFailureDetected = false

  componentDidMount() {
    window.addEventListener('vite:preloadError', this.handlePreloadError)
  }

  componentWillUnmount() {
    window.removeEventListener('vite:preloadError', this.handlePreloadError)
  }

  private handlePreloadError = (event: Event) => {
    const payload = (event as Event & { payload?: unknown }).payload
    if (!isNetworkChunkFailure(payload)) return

    // Vite otherwise reloads automatically. Keep recovery user-initiated so an
    // update cannot discard editor state without the explicit warning below.
    this.chunkFailureDetected = true
    event.preventDefault()
    this.setState({ failed: true, chunkUpdate: true })
  }

  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: unknown) {
    // Do not log exception messages or component props: they can contain user text.
    const chunkUpdate = this.chunkFailureDetected || this.state.chunkUpdate
    this.chunkFailureDetected = false
    console.error({ scope: 'app', code: chunkUpdate ? 'CHUNK_LOAD_FAILED' : 'RENDER_FAILED' })
    this.setState({ failed: true, chunkUpdate })
  }
  render() {
    if (!this.state.failed) return this.props.children
    return this.state.chunkUpdate
      ? <UpdateRecoveryScreen />
      : <RecoveryScreen code="RENDER_FAILED" onRetry={() => window.location.reload()} />
  }
}
