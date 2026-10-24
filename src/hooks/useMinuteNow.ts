import * as React from 'react'

/** A low-frequency wall clock for date filters and daily/weekly summaries. */
export function useMinuteNow(): Date {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  return now
}
