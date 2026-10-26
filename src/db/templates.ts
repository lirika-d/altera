import { createProject, createTask, db, generateId } from './db'
import type { Priority, ProjectWorkflowTemplate, TaskWorkflowTemplate, WorkflowTemplate, WorkflowTaskSeed } from '@/types'

const PRIORITIES: readonly Priority[] = ['urgent', 'high', 'medium', 'low', 'none']
const MAX_TEMPLATE_TASKS = 30

export type NewWorkflowTemplate =
  | Omit<TaskWorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<ProjectWorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>

function requiredText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${label} is required`)
  if (normalized.length > maxLength) throw new Error(`${label} is too long`)
  return normalized
}

function validateTaskSeed(task: WorkflowTaskSeed): WorkflowTaskSeed {
  if (!PRIORITIES.includes(task.priority)) throw new Error('Invalid template task priority')
  return { title: requiredText(task.title, 'Task title', 160), priority: task.priority }
}

function validateNewTemplate(input: NewWorkflowTemplate): NewWorkflowTemplate {
  const name = requiredText(input.name, 'Template name', 80)
  if (!PRIORITIES.includes(input.priority)) throw new Error('Invalid template priority')
  if (input.kind === 'task') {
    return { kind: 'task', name, title: requiredText(input.title, 'Task title', 160), priority: input.priority }
  }
  if (!/^#[\da-f]{6}$/i.test(input.color)) throw new Error('Invalid project color')
  if (!Array.isArray(input.tasks) || input.tasks.length > MAX_TEMPLATE_TASKS) throw new Error('Invalid template task list')
  return {
    kind: 'project',
    name,
    projectName: requiredText(input.projectName, 'Project name', 120),
    description: input.description.trim().slice(0, 2000),
    priority: input.priority,
    color: input.color,
    icon: requiredText(input.icon, 'Project icon', 12),
    nextAction: input.nextAction.trim().slice(0, 300),
    tasks: input.tasks.map(validateTaskSeed),
  }
}

export async function getWorkflowTemplates(kind?: WorkflowTemplate['kind']): Promise<WorkflowTemplate[]> {
  const templates = await db.workflowTemplates.orderBy('updatedAt').reverse().toArray()
  return kind ? templates.filter(template => template.kind === kind) : templates
}

export async function createWorkflowTemplate(input: NewWorkflowTemplate): Promise<WorkflowTemplate> {
  const now = new Date()
  const normalized = validateNewTemplate(input)
  const template = { ...normalized, id: generateId(), createdAt: now, updatedAt: now } as WorkflowTemplate
  await db.workflowTemplates.add(template)
  return template
}

export async function updateWorkflowTemplate(
  id: string,
  input: NewWorkflowTemplate
): Promise<WorkflowTemplate> {
  const normalized = validateNewTemplate(input)
  return db.transaction('rw', db.workflowTemplates, async () => {
    const existing = await db.workflowTemplates.get(id)
    if (!existing) throw new Error('Template not found')
    if (existing.kind !== normalized.kind) throw new Error('Template kind cannot be changed')
    const updated = { ...normalized, id, createdAt: existing.createdAt, updatedAt: new Date() } as WorkflowTemplate
    await db.workflowTemplates.put(updated)
    return updated
  })
}

export async function deleteWorkflowTemplate(id: string): Promise<void> {
  await db.workflowTemplates.delete(id)
}

export async function createTaskFromTemplate(templateId: string, projectId: string) {
  const template = await db.workflowTemplates.get(templateId)
  if (!template || template.kind !== 'task') throw new Error('Task template not found')
  return createTask({ projectId, title: template.title, priority: template.priority, status: 'todo' })
}

export async function createProjectFromTemplate(templateId: string, projectName?: string) {
  return db.transaction('rw', db.workflowTemplates, db.projects, db.tasks, db.activities, async () => {
    const template = await db.workflowTemplates.get(templateId)
    if (!template || template.kind !== 'project') throw new Error('Project template not found')
    const project = await createProject({
      name: requiredText(projectName || template.projectName, 'Project name', 120),
      description: template.description,
      status: 'active',
      priority: template.priority,
      color: template.color,
      icon: template.icon,
      nextAction: template.nextAction,
    })
    for (const task of template.tasks) {
      await createTask({ projectId: project.id, title: task.title, priority: task.priority, status: 'todo' })
    }
    return project
  })
}
