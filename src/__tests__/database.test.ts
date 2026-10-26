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

  it('clears sessions and all Phase 3 knowledge tables together with user data', async () => {
    const project = await createProject(projectInput('Wipe test'))
    await startSession(project.id)

    // Add sample note, tag, assignment, attachment, link
    await db.notes.add({
      id: 'test-note',
      title: 'Test Note',
      contentJSON: '',
      plainText: 'Test',
      isFavorite: false,
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await db.tags.add({
      id: 'test-tag',
      name: 'testing',
      normalizedName: 'testing',
      color: '#3b82f6',
      createdAt: new Date(),
    })
    await db.attachments.add({
      id: 'test-att',
      filename: 'test.txt',
      mimeType: 'text/plain',
      size: 4,
      blob: new Blob(['test'], { type: 'text/plain' }),
      createdAt: new Date(),
    })

    await clearAllData()
    expect(await Promise.all([
      db.projects.count(),
      db.tasks.count(),
      db.activities.count(),
      db.sessions.count(),
      db.notes.count(),
      db.resources.count(),
      db.attachments.count(),
      db.tags.count(),
      db.tagAssignments.count(),
      db.entityLinks.count(),
    ])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('performs complete round-trip JSON backup export and restore including binary Blobs', async () => {
    // 1. Populate tables with knowledge entities and attachment
    const project = await createProject(projectInput('Export Test Project'))
    const note = {
      id: 'note-backup-1',
      title: 'Architecture Note',
      contentJSON: '{"type":"doc"}',
      plainText: 'Architecture Note Plain',
      isFavorite: true,
      revision: 1,
      projectId: project.id,
      createdAt: new Date('2026-10-01T10:00:00Z'),
      updatedAt: new Date('2026-10-01T10:30:00Z'),
    }
    await db.notes.add(note)

    const testBlob = new Blob(['binary file payload'], { type: 'text/plain' })
    const attachment = {
      id: 'att-backup-1',
      filename: 'spec.txt',
      mimeType: 'text/plain',
      size: testBlob.size,
      blob: testBlob,
      createdAt: new Date('2026-10-01T10:00:00Z'),
    }
    await db.attachments.add(attachment)

    const tag = {
      id: 'tag-backup-1',
      name: 'DevOps',
      normalizedName: 'devops',
      color: '#22c55e',
      createdAt: new Date('2026-10-01T10:00:00Z'),
    }
    await db.tags.add(tag)

    await db.tagAssignments.add({
      id: 'ta-backup-1',
      tagId: tag.id,
      entityType: 'note',
      entityId: note.id,
    })

    await db.entityLinks.add({
      id: 'el-backup-1',
      sourceType: 'note',
      sourceId: note.id,
      targetType: 'project',
      targetId: project.id,
      createdAt: new Date('2026-10-01T10:00:00Z'),
    })

    // 2. Export routine (mirroring Settings.tsx logic)
    const [
      projectsData,
      tasksData,
      activitiesData,
      sessionsData,
      notesData,
      resourcesData,
      attachmentsData,
      tagsData,
      tagAssignmentsData,
      entityLinksData,
    ] = await Promise.all([
      db.projects.toArray(),
      db.tasks.toArray(),
      db.activities.toArray(),
      db.sessions.toArray(),
      db.notes.toArray(),
      db.resources.toArray(),
      db.attachments.toArray(),
      db.tags.toArray(),
      db.tagAssignments.toArray(),
      db.entityLinks.toArray(),
    ])

    // Convert Blob to Data URL using standard Web API
    const blobToDataUrl = async (b: Blob, mimeType: string = 'text/plain'): Promise<string> => {
      if (typeof FileReader !== 'undefined') {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(b)
        })
      }
      const arrayBuffer = await b.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i])
      }
      const base64 = btoa(binary)
      return `data:${mimeType};base64,${base64}`
    }

    const serializedAttachments = await Promise.all(
      attachmentsData.map(async (att) => ({
        id: att.id,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        createdAt: att.createdAt,
        blobDataUrl: att.blob instanceof Blob ? await blobToDataUrl(att.blob, att.mimeType) : undefined,
      }))
    )

    const backupPayload = {
      app: 'ALTERA',
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        projects: projectsData,
        tasks: tasksData,
        activities: activitiesData,
        sessions: sessionsData,
        notes: notesData,
        resources: resourcesData,
        attachments: serializedAttachments,
        tags: tagsData,
        tagAssignments: tagAssignmentsData,
        entityLinks: entityLinksData,
      },
    }

    const jsonBackup = JSON.stringify(backupPayload)
    expect(jsonBackup).toContain('Architecture Note')
    expect(jsonBackup).toContain('data:text/plain;base64,')

    // 3. Wipe all data completely
    await clearAllData()
    expect(await db.notes.count()).toBe(0)
    expect(await db.attachments.count()).toBe(0)

    // 4. Restore routine (mirroring Settings.tsx logic)
    const parsed = JSON.parse(jsonBackup)
    expect(parsed.app).toBe('ALTERA')
    expect(parsed.schemaVersion).toBe(3)

    const dataUrlToBlob = (dataUrl: string, mimeType: string): Blob => {
      const parts = dataUrl.split(',')
      const base64 = parts.length > 1 ? parts[1] : parts[0]
      const byteChars = atob(base64)
      const byteArrays = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteArrays[i] = byteChars.charCodeAt(i)
      }
      return new Blob([byteArrays], { type: mimeType })
    }

    const restoredAttachments = (parsed.tables.attachments || []).map((att: any) => ({
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType,
      size: att.size,
      blob: att.blobDataUrl ? dataUrlToBlob(att.blobDataUrl, att.mimeType) : new Blob([]),
      createdAt: new Date(att.createdAt),
    }))

    await db.transaction(
      'rw',
      [
        db.projects,
        db.tasks,
        db.activities,
        db.sessions,
        db.notes,
        db.resources,
        db.attachments,
        db.tags,
        db.tagAssignments,
        db.entityLinks,
      ],
      async () => {
        await db.projects.clear()
        await db.tasks.clear()
        await db.activities.clear()
        await db.sessions.clear()
        await db.notes.clear()
        await db.resources.clear()
        await db.attachments.clear()
        await db.tags.clear()
        await db.tagAssignments.clear()
        await db.entityLinks.clear()

        await db.projects.bulkAdd(parsed.tables.projects.map((p: any) => ({ ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) })))
        await db.notes.bulkAdd(parsed.tables.notes.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt) })))
        await db.attachments.bulkAdd(restoredAttachments)
        await db.tags.bulkAdd(parsed.tables.tags.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })))
        await db.tagAssignments.bulkAdd(parsed.tables.tagAssignments)
        await db.entityLinks.bulkAdd(parsed.tables.entityLinks.map((el: any) => ({ ...el, createdAt: new Date(el.createdAt) })))
      }
    )

    // 5. Assert successful restore
    expect(await db.projects.count()).toBe(1)
    expect(await db.notes.count()).toBe(1)
    expect(await db.attachments.count()).toBe(1)
    expect(await db.tags.count()).toBe(1)
    expect(await db.tagAssignments.count()).toBe(1)
    expect(await db.entityLinks.count()).toBe(1)

    const restoredNote = await db.notes.get('note-backup-1')
    expect(restoredNote?.title).toBe('Architecture Note')
    expect(restoredNote?.isFavorite).toBe(true)

    const restoredAtt = await db.attachments.get('att-backup-1')
    expect(restoredAtt?.filename).toBe('spec.txt')
    expect(restoredAtt?.blob).toBeInstanceOf(Blob)
    expect(restoredAtt?.size).toBe(testBlob.size)
  })
})
