import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, clearAllData, createProject, createTask, deleteProject, deleteTask } from '@/db/db'
import { createNote, createResource, createTag, assignTag, createEntityLink } from '@/db/knowledge'
import { startSession, completeSession, deleteSession } from '@/db/sessions'
import { validateBackup } from '@/db/backupValidation'
import { importBackup } from '@/db/backupImport'

beforeEach(async () => { vi.restoreAllMocks(); await clearAllData() })
async function setup() {
  const project = await createProject({ name: 'History', description: '', status: 'active', priority: 'none', color: '#fff', icon: '', nextAction: '' })
  const task = await createTask({ projectId: project.id, title: 'Task', status: 'todo', priority: 'none' })
  const note = await createNote({ title: 'Keep me', projectId: project.id })
  const resource = await createResource({ type: 'link', title: 'Keep link', projectId: project.id })
  const tag = await createTag({ name: 'Tag' })
  await assignTag(tag.id, 'task', task.id)
  await assignTag(tag.id, 'project', project.id)
  await createEntityLink('note', note.id, 'task', task.id)
  await createEntityLink('task', task.id, 'note', note.id)
  await createEntityLink('project', project.id, 'resource', resource.id)
  return { project, task, note, resource, tag }
}

describe('graph cleanup', () => {
  it('preserves knowledge and completed history and round-trips the deleted-project snapshot', async () => {
    const { project, task, note, resource } = await setup()
    const fileContents = 'preserved attachment payload'
    const attachment = {
      id: 'project-file-attachment',
      filename: 'project-reference.txt',
      mimeType: 'text/plain',
      size: fileContents.length,
      blob: new Blob([fileContents], { type: 'text/plain' }),
      createdAt: new Date(),
    }
    await db.attachments.add(attachment)
    const fileResource = await createResource({
      type: 'file',
      title: 'Keep attached file',
      projectId: project.id,
      attachmentId: attachment.id,
    })
    const session = await startSession(project.id, { taskId: task.id })
    await completeSession(session.id)
    await deleteProject(project.id)
    expect((await db.notes.get(note.id))?.projectId).toBeUndefined()
    expect((await db.notes.get(note.id))?.revision).toBe(note.revision + 1)
    expect((await db.resources.get(resource.id))?.projectId).toBeUndefined()
    expect((await db.resources.get(fileResource.id))?.projectId).toBeUndefined()
    expect((await db.attachments.get(attachment.id))?.blob.size).toBe(attachment.size)
    const history = await db.sessions.get(session.id)
    expect(history?.projectSnapshot).toEqual({ id: project.id, name: project.name, identifier: project.identifier })
    expect(history?.taskId).toBeUndefined()
    expect(await db.tagAssignments.count()).toBe(0)
    expect(await db.entityLinks.count()).toBe(0)
    const tables = Object.fromEntries(await Promise.all(db.tables.filter(t => t.name !== 'metadata' && t.name !== 'attachments').map(async t => [t.name, await t.toArray()])))
    tables.attachments = await Promise.all((await db.attachments.toArray()).map(async item => {
      const bytes = new Uint8Array(await item.blob.arrayBuffer())
      const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
      return {
        id: item.id,
        filename: item.filename,
        mimeType: item.mimeType,
        size: item.size,
        createdAt: item.createdAt,
        blobDataUrl: `data:${item.mimeType};base64,${btoa(binary)}`,
      }
    }))
    const backup = JSON.parse(JSON.stringify({ app: 'ALTERA', schemaVersion: 3, exportedAt: new Date().toISOString(), tables }))
    expect(() => validateBackup(backup)).not.toThrow()

    // Exercise the actual import transaction with the JSON-serialized snapshot.
    await importBackup(backup)
    expect(await db.projects.count()).toBe(0)
    expect((await db.notes.get(note.id))?.title).toBe('Keep me')
    expect((await db.resources.get(resource.id))?.title).toBe('Keep link')
    expect(await (await db.attachments.get(attachment.id))?.blob.text()).toBe(fileContents)
    expect((await db.resources.get(fileResource.id))?.attachmentId).toBe(attachment.id)
    expect((await db.sessions.get(session.id))?.projectSnapshot).toEqual({
      id: project.id,
      name: project.name,
      identifier: project.identifier,
    })
  })
  it('detaches a deleted task from running sessions and activity', async () => {
    const { project, task } = await setup()
    const session = await startSession(project.id, { taskId: task.id })
    await deleteTask(task.id)
    expect((await db.sessions.get(session.id))?.taskId).toBeUndefined()
    expect((await db.sessions.get(session.id))?.status).toBe('running')
    expect(await db.activities.where('taskId').equals(task.id).count()).toBe(0)
    expect(await db.tagAssignments.where('entityId').equals(task.id).count()).toBe(0)
    expect(await db.entityLinks.where('targetId').equals(task.id).count()).toBe(0)
    expect(await db.entityLinks.where('sourceId').equals(task.id).count()).toBe(0)
  })
  it('rolls back the entire project graph when a write fails', async () => {
    const { project, note } = await setup()
    vi.spyOn(db.projects, 'delete').mockRejectedValueOnce(new Error('storage failure'))
    await expect(deleteProject(project.id)).rejects.toThrow('storage failure')
    expect((await db.notes.get(note.id))?.projectId).toBe(project.id)
    expect(await db.tasks.count()).toBe(1)
    expect(await db.entityLinks.count()).toBe(3)
  })
  it('cleans session tags and links on session deletion', async () => {
    const { project, note, tag } = await setup()
    const session = await startSession(project.id)
    await assignTag(tag.id, 'session', session.id)
    await createEntityLink('session', session.id, 'note', note.id)
    await deleteSession(session.id)
    expect(await db.tagAssignments.where('entityId').equals(session.id).count()).toBe(0)
    expect(await db.entityLinks.where('sourceId').equals(session.id).count()).toBe(0)
  })
})
