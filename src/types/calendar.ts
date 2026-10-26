export type WorkBlockStatus = 'planned' | 'completed' | 'cancelled'

/** A scheduled instant is stored as a Date and rendered in the user's local time zone. */
export interface ScheduledWorkBlock {
  id: string
  title: string
  description?: string
  projectId?: string
  taskId?: string
  scheduledStart: Date
  scheduledEnd: Date
  status: WorkBlockStatus
  createdAt: Date
  updatedAt: Date
}

export interface ScheduledWorkBlockInput {
  title: string
  description?: string
  projectId?: string
  taskId?: string
  scheduledStart: Date
  scheduledEnd: Date
  status?: WorkBlockStatus
}

export type ScheduledWorkBlockUpdate = Partial<ScheduledWorkBlockInput>
