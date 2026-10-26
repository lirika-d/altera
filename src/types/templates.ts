import type { Priority } from './index'

export interface WorkflowTaskSeed {
  title: string
  priority: Priority
}

interface WorkflowTemplateBase {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface TaskWorkflowTemplate extends WorkflowTemplateBase {
  kind: 'task'
  title: string
  priority: Priority
}

export interface ProjectWorkflowTemplate extends WorkflowTemplateBase {
  kind: 'project'
  projectName: string
  description: string
  priority: Priority
  color: string
  icon: string
  nextAction: string
  tasks: WorkflowTaskSeed[]
}

export type WorkflowTemplate = TaskWorkflowTemplate | ProjectWorkflowTemplate
