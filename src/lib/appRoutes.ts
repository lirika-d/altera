import type { DefaultRoute } from '@/types/preferences'

/** Stable, typed route contracts for cross-page navigation and command intents. */
export const appRoutes = {
  defaultRoutePath(route: DefaultRoute): string | null {
    if (route === 'workspace') return null
    return `/${route}`
  },
  project(projectId: string): string {
    return `/projects/${encodeURIComponent(projectId)}`
  },
  task(taskId: string, projectId?: string): string {
    return projectId
      ? `/projects/${encodeURIComponent(projectId)}?task=${encodeURIComponent(taskId)}`
      : `/my-tasks?task=${encodeURIComponent(taskId)}`
  },
  session(sessionId: string): string {
    return `/sessions?session=${encodeURIComponent(sessionId)}`
  },
  startSession(): string {
    return '/sessions?action=start'
  },
  createTask(templateId?: string): string {
    const params = new URLSearchParams({ action: 'create' })
    if (templateId) params.set('template', templateId)
    return `/my-tasks?${params.toString()}`
  },
  createProjectFromTemplate(templateId: string): string {
    const params = new URLSearchParams({ action: 'create-from-template', template: templateId })
    return `/projects?${params.toString()}`
  },
  startSessionFromBlock(projectId: string, taskId: string | undefined, blockId: string): string {
    const params = new URLSearchParams({ action: 'start', project: projectId, block: blockId })
    if (taskId) params.set('task', taskId)
    return `/sessions?${params.toString()}`
  },
  calendar(): string {
    return '/calendar'
  },
  calendarBlock(blockId: string): string {
    return `/calendar?block=${encodeURIComponent(blockId)}`
  },
  scheduleTask(taskId: string): string {
    return `/calendar?task=${encodeURIComponent(taskId)}`
  },
  knowledgeNote(noteId: string): string {
    return `/knowledge?tab=notes&note=${encodeURIComponent(noteId)}`
  },
  knowledgeResource(resourceId: string): string {
    return `/knowledge?tab=resources&resource=${encodeURIComponent(resourceId)}`
  },
  createNote(): string {
    return '/knowledge?tab=notes&action=create'
  },
  createResource(): string {
    return '/knowledge?tab=resources&action=create'
  },
} as const

export type KnowledgeHubAction = 'create-note' | 'create-resource'

/** Accept the original action names too so previously copied links still work. */
export function getKnowledgeHubAction(params: URLSearchParams): KnowledgeHubAction | null {
  const action = params.get('action')
  if (action === 'create-note' || (action === 'create' && params.get('tab') === 'notes')) {
    return 'create-note'
  }
  if (action === 'create-resource' || (action === 'create' && params.get('tab') === 'resources')) {
    return 'create-resource'
  }
  return null
}
