import { Download, FileJson, Sheet } from 'lucide-react'
import type { AnalyticsComparison, PlannedActualSummary } from '../analytics.advanced'
import type { AnalyticsMetrics } from '../analytics.types'
import { buildAnalyticsReport, serializeAnalyticsCsv, serializeAnalyticsJson } from '../analytics.export'
import { getLocalDateKey } from '../analytics.utils'
import { useTranslation } from '@/i18n'

function saveLocalFile(filename: string, contents: string, type: string): void {
  const file = new Blob([contents], { type })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function AnalyticsExportActions({
  metrics,
  planning,
  comparison,
  projectId,
}: {
  metrics: AnalyticsMetrics
  planning: PlannedActualSummary
  comparison?: AnalyticsComparison
  projectId?: string
}) {
  const { t } = useTranslation('insights')
  const exportReport = (format: 'csv' | 'json') => {
    const report = buildAnalyticsReport(metrics, planning, comparison, projectId, new Date())
    const date = getLocalDateKey(new Date())
    if (format === 'csv') {
      saveLocalFile(`ALTERA-insights-${date}.csv`, serializeAnalyticsCsv(report), 'text/csv;charset=utf-8')
      return
    }
    saveLocalFile(`ALTERA-insights-${date}.json`, serializeAnalyticsJson(report), 'application/json;charset=utf-8')
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t('insights.export.title')}>
      <button type="button" onClick={() => exportReport('csv')} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive">
        <Sheet aria-hidden="true" className="h-3.5 w-3.5" />{t('insights.export.csv')}
      </button>
      <button type="button" onClick={() => exportReport('json')} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-xs text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-olive">
        <FileJson aria-hidden="true" className="h-3.5 w-3.5" />{t('insights.export.json')}
      </button>
      <span className="inline-flex items-center gap-1 text-[10px] text-text-muted"><Download aria-hidden="true" className="h-3 w-3" />{t('insights.export.localOnly')}</span>
    </div>
  )
}
