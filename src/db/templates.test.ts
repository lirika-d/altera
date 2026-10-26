import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AlteraDB, clearAllData, createProject, db } from '@/db/db'
import { createProjectFromTemplate, createTaskFromTemplate, createWorkflowTemplate, deleteWorkflowTemplate, getWorkflowTemplates, updateWorkflowTemplate } from '@/db/templates'

const projectTemplateInput = {
  kind: 'project' as const,
  name: 'Launch checklist',
  projectName: 'New launch',
  description: 'A prepared project',
  priority: 'high' as const,
  color: '#8a9e6b',
  icon: '🚀',
  nextAction: 'Confirm scope',
  tasks: [
    { title: 'Review requirements', priority: 'high' as const },
    { title: 'Plan first milestone', priority: 'medium' as const },
  ],
}

const taskTemplateInput = { kind: 'task' as const, name: 'Review', title: 'Review the draft', priority: 'medium' as const }

beforeEach(async () => {
  vi.restoreAllMocks()
  await clearAllData()
})

describe('workflow templates', () => {
  it('supports create, edit, list and delete with validated data', async () => {
    const created = await createWorkflowTemplate(taskTemplateInput)
    expect(created).toMatchObject({ ...taskTemplateInput, id: expect.any(String) })
    const updated = await updateWorkflowTemplate(created.id, { ...taskTemplateInput, title: 'Review the final draft' })
    expect(updated.kind).toBe('task')
    if (updated.kind === 'task') expect(updated.title).toBe('Review the final draft')
    expect(await getWorkflowTemplates('task')).toHaveLength(1)
    await deleteWorkflowTemplate(created.id)
    expect(await getWorkflowTemplates()).toHaveLength(0)
    await expect(createWorkflowTemplate({ ...taskTemplateInput, title: ' ' })).rejects.toThrow('Task title is required')
  })

  it('creates a new unfinished task from a task template in the selected project', async () => {
    const project = await createProject({ name: 'Target', description: '', status: 'active', priority: 'medium', color: '#3b82f6', icon: '📁', nextAction: '' })
    const template = await createWorkflowTemplate(taskTemplateInput)
    const task = await createTaskFromTemplate(template.id, project.id)
    expect(task).toMatchObject({ projectId: project.id, title: 'Review the draft', status: 'todo', priority: 'medium' })
    expect(task.id).not.toBe(template.id)
  })

  it('creates a fresh project and its independent unfinished tasks from a template', async () => {
    const template = await createWorkflowTemplate(projectTemplateInput)
    const project = await createProjectFromTemplate(template.id, 'Launch Q4')
    const tasks = await dbTasksFor(project.id)
    expect(project.name).toBe('Launch Q4')
    expect(tasks.map(task => task.title)).toEqual(['Review requirements', 'Plan first milestone'])
    expect(tasks.every(task => task.status === 'todo' && task.id !== template.id)).toBe(true)
    expect((await getWorkflowTemplates('project'))[0].id).toBe(template.id)
  })

  it('rolls back project creation if one of its initial task writes fails', async () => {
    const template = await createWorkflowTemplate(projectTemplateInput)
    vi.spyOn(db.tasks, 'add').mockRejectedValueOnce(new Error('task write failed'))

    await expect(createProjectFromTemplate(template.id)).rejects.toThrow('task write failed')
    expect(await db.projects.count()).toBe(0)
    expect(await db.tasks.count()).toBe(0)
    expect(await db.activities.count()).toBe(0)
    expect(await db.workflowTemplates.get(template.id)).toBeDefined()
  })

  it('clears templates only when the user explicitly clears workspace data', async () => {
    await createWorkflowTemplate(taskTemplateInput)
    await clearAllData()
    expect(await db.workflowTemplates.count()).toBe(0)
    expect((await db.metadata.get('initialized'))?.value).toBe(true)
  })

  it('upgrades a populated v9 database additively to schema v10', async () => {
    const name = `AlteraPhase6Migration-${Date.now()}-${Math.random()}`
    const legacy = new Dexie(name)
    legacy.version(9).stores({
      projects: 'id, identifier, status, priority, lastVisitedAt, createdAt, updatedAt',
      tasks: 'id, projectId, status, priority, order, dueDate, createdAt, updatedAt',
      activities: 'id, projectId, taskId, type, createdAt',
      sessions: 'id, projectId, taskId, scheduledBlockId, status, startedAt, updatedAt, createdAt',
      notes: 'id, projectId, isFavorite, deletedAt, updatedAt, createdAt, revision',
      resources: 'id, projectId, type, isFavorite, deletedAt, updatedAt, createdAt',
      attachments: 'id, filename, mimeType, createdAt',
      tags: 'id, &name, normalizedName, createdAt',
      tagAssignments: 'id, tagId, entityType, entityId, [tagId+entityId], [entityId+tagId]',
      entityLinks: 'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceId+targetId], &[sourceType+sourceId+targetType+targetId]',
      metadata: 'key',
      scheduledWorkBlocks: 'id, projectId, taskId, scheduledStart, scheduledEnd, status, createdAt, updatedAt',
    })
    await legacy.open()
    await legacy.table('projects').add({
      id: 'keep-project', identifier: 'ALT-001', name: 'Keep existing', description: '', status: 'active', priority: 'medium',
      color: '#3b82f6', icon: '📁', progress: 0, nextAction: '', createdAt: new Date(), updatedAt: new Date(),
    })
    legacy.close()

    const upgraded = new AlteraDB(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(10)
    expect((await upgraded.projects.get('keep-project'))?.name).toBe('Keep existing')
    expect(await upgraded.workflowTemplates.count()).toBe(0)
    await upgraded.delete()
  })
})

async function dbTasksFor(projectId: string) {
  return db.tasks.where('projectId').equals(projectId).sortBy('order')
}

