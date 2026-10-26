export type CalendarLocale = 'ru' | 'en'

export function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime())
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Calendar arithmetic uses local date constructors so DST does not shift wall-clock dates. */
export function addCalendarDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

export function addCalendarMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function firstDayOfWeek(locale: CalendarLocale): 0 | 1 {
  return locale === 'ru' ? 1 : 0
}

export function startOfLocaleWeek(date: Date, locale: CalendarLocale): Date {
  const start = firstDayOfWeek(locale)
  const daysSinceStart = (date.getDay() - start + 7) % 7
  return addCalendarDays(date, -daysSinceStart)
}

export function getCalendarRange(date: Date, view: 'day' | 'week' | 'month', locale: CalendarLocale): { start: Date; end: Date } {
  if (!isValidDate(date)) throw new RangeError('Invalid calendar date')
  const start = view === 'day'
    ? startOfLocalDay(date)
    : view === 'week'
      ? startOfLocaleWeek(date, locale)
      : startOfLocaleWeek(new Date(date.getFullYear(), date.getMonth(), 1), locale)

  if (view === 'day') return { start, end: addCalendarDays(start, 1) }
  if (view === 'week') return { start, end: addCalendarDays(start, 7) }

  // A stable six-row month canvas keeps weekday columns aligned across months.
  return { start, end: addCalendarDays(start, 42) }
}

export function localDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function localTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Add wall-clock minutes while carrying across local calendar dates safely. */
export function localDateTimeAfterMinutes(date: Date, amount: number): { date: string; time: string } {
  if (!isValidDate(date) || !Number.isFinite(amount)) throw new RangeError('INVALID_LOCAL_DATE_TIME')
  const total = date.getHours() * 60 + date.getMinutes() + amount
  const dayOffset = Math.floor(total / (24 * 60))
  const minuteOfDay = ((total % (24 * 60)) + (24 * 60)) % (24 * 60)
  const targetDate = dayOffset === 0 ? date : addCalendarDays(date, dayOffset)
  return {
    date: localDateKey(targetDate),
    time: `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`,
  }
}

/**
 * Parse an HTML date/time pair as a local wall time. Nonexistent DST times are
 * rejected instead of being silently normalized by the Date constructor. For
 * ambiguous fall-back times, JavaScript's local Date behavior selects the first
 * occurrence; callers can show that resolved local time back to the user.
 */
export function parseLocalDateTime(dateValue: string, timeValue: string): Date {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  const timeParts = /^(\d{2}):(\d{2})$/.exec(timeValue)
  if (!dateParts || !timeParts) throw new RangeError('INVALID_LOCAL_DATE_TIME')

  const [, year, month, day] = dateParts
  const [, hour, minute] = timeParts
  const parts = [year, month, day, hour, minute].map(Number)
  const [yearNumber, monthNumber, dayNumber, hourNumber, minuteNumber] = parts
  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31 || hourNumber > 23 || minuteNumber > 59) {
    throw new RangeError('INVALID_LOCAL_DATE_TIME')
  }

  const result = new Date(yearNumber, monthNumber - 1, dayNumber, hourNumber, minuteNumber, 0, 0)
  if (
    result.getFullYear() !== yearNumber || result.getMonth() !== monthNumber - 1 ||
    result.getDate() !== dayNumber || result.getHours() !== hourNumber || result.getMinutes() !== minuteNumber
  ) {
    throw new RangeError('NONEXISTENT_LOCAL_TIME')
  }
  return result
}

export function compareLocalDays(a: Date, b: Date): number {
  const aDay = startOfLocalDay(a).getTime()
  const bDay = startOfLocalDay(b).getTime()
  return aDay === bDay ? 0 : aDay < bDay ? -1 : 1
}

export function dateRangeDurationMs(start: Date, end: Date): number {
  if (!isValidDate(start) || !isValidDate(end)) return Number.NaN
  return end.getTime() - start.getTime()
}

