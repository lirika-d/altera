import { describe, expect, it } from 'vitest'
import { appRoutes, getKnowledgeHubAction } from './appRoutes'

describe('application route contracts', () => {
  it('maps the saved default route without redirecting Workspace back to itself', () => {
    expect(appRoutes.defaultRoutePath('workspace')).toBeNull()
    expect(appRoutes.defaultRoutePath('my-tasks')).toBe('/my-tasks')
    expect(appRoutes.defaultRoutePath('calendar')).toBe('/calendar')
  })

  it('encodes ids and points at the entity-aware destination', () => {
    expect(appRoutes.project('project/1')).toBe('/projects/project%2F1')
    expect(appRoutes.task('task 1', 'project/1')).toBe('/projects/project%2F1?task=task%201')
    expect(appRoutes.task('task-1')).toBe('/my-tasks?task=task-1')
    expect(appRoutes.session('session 1')).toBe('/sessions?session=session%201')
    expect(appRoutes.knowledgeNote('note/1')).toBe('/knowledge?tab=notes&note=note%2F1')
    expect(appRoutes.knowledgeResource('resource 1')).toBe('/knowledge?tab=resources&resource=resource%201')
  })

  it('uses the same destination contracts for palette creation actions', () => {
    expect(appRoutes.createNote()).toBe('/knowledge?tab=notes&action=create')
    expect(appRoutes.createResource()).toBe('/knowledge?tab=resources&action=create')
    expect(appRoutes.startSession()).toBe('/sessions?action=start')
    expect(appRoutes.createTask()).toBe('/my-tasks?action=create')
    expect(appRoutes.createTask('task template/1')).toBe('/my-tasks?action=create&template=task+template%2F1')
    expect(appRoutes.createProjectFromTemplate('project template 1')).toBe('/projects?action=create-from-template&template=project+template+1')
  })

  it('builds calendar planner and block-based focus intents', () => {
    expect(appRoutes.scheduleTask('task a')).toBe('/calendar?task=task%20a')
    expect(appRoutes.calendarBlock('block a')).toBe('/calendar?block=block%20a')
    const focus = new URLSearchParams(appRoutes.startSessionFromBlock('project a', 'task a', 'block a').split('?')[1])
    expect(Object.fromEntries(focus)).toEqual({ action: 'start', project: 'project a', block: 'block a', task: 'task a' })
  })

  it('parses canonical and legacy knowledge action URLs', () => {
    expect(getKnowledgeHubAction(new URLSearchParams('tab=notes&action=create'))).toBe('create-note')
    expect(getKnowledgeHubAction(new URLSearchParams('tab=resources&action=create'))).toBe('create-resource')
    expect(getKnowledgeHubAction(new URLSearchParams('action=create-note'))).toBe('create-note')
    expect(getKnowledgeHubAction(new URLSearchParams('action=create-resource'))).toBe('create-resource')
    expect(getKnowledgeHubAction(new URLSearchParams('tab=notes&action=unknown'))).toBeNull()
  })
})
