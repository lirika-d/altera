import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllData,
  createProject,
  createTask,
  db,
  deleteProject,
  updateTask,
} from '@/db/db'
import { completeSession, startSession } from '@/db/sessions'

const projectInput = (name: string) => ({
  name,
  description: '',
  status: 'active' as const,
  priority: 'medium' as const,
  color: '#3b82f6',
  icon: '🧪',
  nextAction: '',
})

beforeEach(async () => {
  vi.restoreAllMocks()
  await db.open()
  await clearAllData()
})

describe('database integrity', () => {
  it('allocates distinct project identifiers under simultaneous creation', async () => {
    const [first, second] = await Promise.all([
      createProject(projectInput('First')),
      createProject(projectInput('Second')),
    ])

    expect(first.identifier).not.toBe(second.identifier)
    expect(new Set((await db.projects.toArray()).map((project) => project.identifier)).size).toBe(2)
  })

  it('rejects task creation for a missing project without partial writes', async () => {
    await expect(createTask({
      projectId: 'missing',
      title: 'Orphan task',
      status: 'todo',
      priority: 'medium',
    })).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })

    expect(await db.tasks.count()).toBe(0)
    expect(await db.activities.count()).toBe(0)
  })

  it('rolls back task status and project progress when activity logging fails', async () => {
    const project = await createProject(projectInput('Atomic task updates'))
    const task = await createTask({
      projectId: project.id,
      title: 'Finish me',
      status: 'todo',
      priority: 'medium',
    })
    vi.spyOn(db.activities, 'add').mockRejectedValueOnce(new Error('activity write failed'))

    await expect(updateTask(task.id, { status: 'done' })).rejects.toThrow('activity write failed')
    expect((await db.tasks.get(task.id))?.status).toBe('todo')
    expect((await db.projects.get(project.id))?.progress).toBe(0)
  })

  it('prevents deleting a project that owns an unfinished session', async () => {
    const project = await createProject(projectInput('Protected project'))
    const session = await startSession(project.id)

    await expect(deleteProject(project.id)).rejects.toMatchObject({
      code: 'PROJECT_HAS_ACTIVE_SESSION',
    })
    expect(await db.projects.get(project.id)).toBeDefined()
    expect(await db.sessions.get(session.id)).toBeDefined()
  })

  it('preserves completed session history when its project is deleted', async () => {
    const project = await createProject(projectInput('Deletable project'))
    const session = await startSession(project.id)
    await completeSession(session.id)

    await deleteProject(project.id)
    expect(await db.projects.get(project.id)).toBeUndefined()
    expect((await db.sessions.get(session.id))?.status).toBe('completed')
  })

  it('clears sessions together with all other user data', async () => {
    const project = await createProject(projectInput('Wipe test'))
    await startSession(project.id)

    await clearAllData()
    expect(await Promise.all([
      db.projects.count(),
      db.tasks.count(),
      db.activities.count(),
      db.sessions.count(),
    ])).toEqual([0, 0, 0, 0])
  })
})
