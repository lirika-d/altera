import type { ScheduledWorkBlock } from '@/types/calendar'

export interface PositionedBlock {
  block: ScheduledWorkBlock
  top: number
  height: number
  left: number
  width: number
}

/** Assigns the smallest free horizontal lane to each overlapping time interval. */
export function layoutOverlappingBlocks(
  blocks: ScheduledWorkBlock[],
  dayStart: Date,
  minHeight = 24
): PositionedBlock[] {
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1)
  const visible = blocks
    .filter(block => block.scheduledEnd > dayStart && block.scheduledStart < dayEnd)
    .map(block => {
      const start = block.scheduledStart < dayStart ? dayStart : block.scheduledStart
      const end = block.scheduledEnd > dayEnd ? dayEnd : block.scheduledEnd
      const top = start.getTime() === dayStart.getTime() ? 0 : (start.getHours() * 60 + start.getMinutes()) * 64 / 60
      const bottom = end.getTime() === dayEnd.getTime() ? 24 * 64 : (end.getHours() * 60 + end.getMinutes()) * 64 / 60
      return { block, top, bottom: Math.max(bottom, top + minHeight), startMs: start.getTime(), endMs: end.getTime(), left: 0, width: 100 }
    })
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  const lanes: number[] = []
  const positioned = visible.map(item => {
    let lane = lanes.findIndex(end => end <= item.startMs)
    if (lane < 0) lane = lanes.length
    lanes[lane] = item.endMs
    return { ...item, lane }
  })

  // Connected overlap groups share a width equal to their largest lane count.
  let groupStart = 0
  while (groupStart < positioned.length) {
    let groupEnd = groupStart + 1
    let clusterEnd = positioned[groupStart].endMs
    while (groupEnd < positioned.length && positioned[groupEnd].startMs < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, positioned[groupEnd].endMs)
      groupEnd++
    }
    const laneCount = Math.max(1, ...positioned.slice(groupStart, groupEnd).map(item => item.lane + 1))
    for (let i = groupStart; i < groupEnd; i++) {
      positioned[i].width = 100 / laneCount
      positioned[i].left = positioned[i].lane * 100 / laneCount
    }
    groupStart = groupEnd
  }

  return positioned.map(item => ({
    block: item.block,
    top: item.top,
    height: item.bottom - item.top,
    left: item.left,
    width: item.width,
  }))
}
