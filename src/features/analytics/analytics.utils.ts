import { addCalendarDays, localDateKey, startOfLocalDay } from '@/lib/calendarDates'
import type { AnalyticsDateRange, AnalyticsGranularity, AnalyticsRangeKey } from './analytics.types'

export function getAnalyticsDateRange(key: AnalyticsRangeKey, now: Date): AnalyticsDateRange {
  if (!Number.isFinite(now.getTime())) throw new RangeError('INVALID_ANALYTICS_DATE')
  if (key === 'custom') throw new RangeError('CUSTOM_ANALYTICS_RANGE_REQUIRED')

  const today = startOfLocalDay(now)
  const end = addCalendarDays(today, 1)
  if (key === 'all') return { key, end, granularity: 'month' }

  const days = key === 'today' ? 1 : key === '7d' ? 7 : key === '30d' ? 30 : 90
  return {
    key,
    start: addCalendarDays(today, 1 - days),
    end,
    granularity: 'day',
  }
}

/** Inclusive local-date inputs become a half-open local [start, end) range. */
export function getCustomAnalyticsDateRange(startKey: string, endKey: string): AnalyticsDateRange | undefined {
  const startDate = parseLocalDateKey(startKey)
  const endDate = parseLocalDateKey(endKey)
  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) return undefined
  const start = startOfLocalDay(startDate)
  const end = addCalendarDays(startOfLocalDay(endDate), 1)
  const dayCount = localDateOrdinal(end) - localDateOrdinal(start)
  return { key: 'custom', start, end, granularity: dayCount > 180 ? 'month' : 'day' }
}

/** Previous equal-length local-calendar interval; all-time has no meaningful peer. */
export function getPreviousAnalyticsDateRange(range: AnalyticsDateRange): AnalyticsDateRange | undefined {
  if (!range.start || range.key === 'all') return undefined
  const dayCount = localDateOrdinal(range.end) - localDateOrdinal(range.start)
  if (dayCount <= 0) return undefined
  return {
    key: range.key,
    start: addCalendarDays(range.start, -dayCount),
    end: new Date(range.start),
    granularity: range.granularity,
  }
}

function localDateOrdinal(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

export function dateTimestamp(value: Date | string | number | undefined): number | undefined {
  if (value === undefined) return undefined
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

export function getLocalDateKey(date: Date): string {
  return localDateKey(date)
}

export function parseLocalDateKey(key: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return undefined
  const [, year, month, day] = match
  const result = new Date(Number(year), Number(month) - 1, Number(day), 12)
  if (
    result.getFullYear() !== Number(year) || result.getMonth() !== Number(month) - 1
    || result.getDate() !== Number(day)
  ) return undefined
  return result
}

export function isWithinAnalyticsRange(timestamp: number, range: AnalyticsDateRange): boolean {
  return Number.isFinite(timestamp)
    && (range.start === undefined || timestamp >= range.start.getTime())
    && timestamp < range.end.getTime()
}

export function getAnalyticsPeriodKey(date: Date, granularity: AnalyticsGranularity): string {
  if (granularity === 'day') return localDateKey(date)
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseAnalyticsPeriodKey(key: string, granularity: AnalyticsGranularity): Date | undefined {
  const match = granularity === 'day'
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
    : /^(\d{4})-(\d{2})$/.exec(key)
  if (!match) return undefined
  const [year, month, day = '1'] = match.slice(1)
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return undefined
  }
  return date
}

/** User-facing duration: whole hours and remaining minutes, with locale units. */
export function formatAnalyticsDuration(ms: number, locale: string): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0
  const totalMinutes = Math.floor(safeMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const unit = (value: number, unitName: 'hour' | 'minute') => new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: unitName,
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  }).format(value)

  if (hours === 0 && minutes === 0) return unit(0, 'minute')
  if (hours === 0) return unit(minutes, 'minute')
  if (minutes === 0) return unit(hours, 'hour')
  return `${unit(hours, 'hour')} ${unit(minutes, 'minute')}`
}

export function formatCompactDuration(ms: number, locale: string): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0
  const hours = Math.floor(safeMs / 3_600_000)
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}${locale.startsWith('ru') ? 'ч' : 'h'}`
  return `${minutes}${locale.startsWith('ru') ? 'м' : 'm'}`
}

export function safeProjectColor(value: string | undefined, fallback = '#8a9e6b'): string {
  return value && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value) ? value : fallback
}

export function saturatingAdd(total: number, value: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, total + value)
}
