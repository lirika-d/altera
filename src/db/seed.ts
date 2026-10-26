import { db, generateId } from './db'
import type {
  Project,
  Task,
  Activity,
  Session,
  Note,
  Resource,
  Tag,
  TagAssignment,
  EntityLink,
} from '@/types'

export async function seedDatabase(): Promise<void> {
  const now = new Date()
  const minutesAgo = (mins: number) => new Date(now.getTime() - mins * 60 * 1000)
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000)
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

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
      db.scheduledWorkBlocks,
      db.workflowTemplates,
      db.metadata,
    ],
    async () => {
      await db.metadata.put({ key: 'initialized', value: true })
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
      await db.scheduledWorkBlocks.clear()
      await db.workflowTemplates.clear()

    const projects: Project[] = [
      {
        id: 'proj-1',
        identifier: 'ALT-001',
        name: 'ALTERA Core Engine',
        description: 'High-performance local-first storage and reactive query architecture powered by IndexedDB.',
        status: 'active',
        priority: 'urgent',
        color: '#3b82f6',
        icon: '⚡',
        progress: 63,
        nextAction: 'Implement Dexie sync layer',
        createdAt: daysAgo(14),
        updatedAt: minutesAgo(10),
        lastVisitedAt: minutesAgo(10),
      },
      {
        id: 'proj-2',
        identifier: 'ALT-002',
        name: 'Marketing Site Redesign',
        description: 'Dark-mode first brand identity and product showcase website built with modern CSS and fluid animations.',
        status: 'active',
        priority: 'high',
        color: '#8b5cf6',
        icon: '🎨',
        progress: 33,
        nextAction: 'Review Figma handoff',
        createdAt: daysAgo(10),
        updatedAt: hoursAgo(1),
        lastVisitedAt: hoursAgo(1),
      },
      {
        id: 'proj-3',
        identifier: 'ALT-003',
        name: 'API Documentation',
        description: 'Comprehensive developer guides, interactive OpenAPI specifications, and integration cookbook.',
        status: 'backlog',
        priority: 'medium',
        color: '#22c55e',
        icon: '📚',
        progress: 17,
        nextAction: 'Outline OpenAPI spec',
        createdAt: daysAgo(20),
        updatedAt: daysAgo(2),
        lastVisitedAt: daysAgo(2),
      },
      {
        id: 'proj-4',
        identifier: 'ALT-004',
        name: 'Q4 Planning',
        description: 'Quarterly roadmap alignment, team capacity modeling, and executive budget review.',
        status: 'paused',
        priority: 'low',
        color: '#f59e0b',
        icon: '📊',
        progress: 80,
        nextAction: 'Finalize headcount numbers',
        createdAt: daysAgo(30),
        updatedAt: daysAgo(4),
        lastVisitedAt: daysAgo(4),
      },
      {
        id: 'proj-5',
        identifier: 'ALT-005',
        name: 'Onboarding Flow',
        description: 'Zero-friction new user journey featuring instant template creation and interactive keyboard shortcut hints.',
        status: 'active',
        priority: 'high',
        color: '#06b6d4',
        icon: '🚀',
        progress: 57,
        nextAction: 'User test session 3',
        createdAt: daysAgo(8),
        updatedAt: minutesAgo(30),
        lastVisitedAt: minutesAgo(30),
      },
      {
        id: 'proj-6',
        identifier: 'ALT-006',
        name: 'Legacy Data Migration',
        description: 'Export and migration utilities for transitioning legacy SQLite schemas to browser IndexedDB storage.',
        status: 'completed',
        priority: 'medium',
        color: '#10b981',
        icon: '🔄',
        progress: 100,
        nextAction: 'All migrations executed and verified',
        createdAt: daysAgo(25),
        updatedAt: daysAgo(3),
        lastVisitedAt: daysAgo(3),
      },
      {
        id: 'proj-7',
        identifier: 'ALT-007',
        name: 'Mobile Touch Controls',
        description: 'Experimental responsive gesture navigation and swipe gestures for tablet devices.',
        status: 'archived',
        priority: 'none',
        color: '#64748b',
        icon: '📱',
        progress: 25,
        nextAction: 'Archived pending v2 tablet redesign',
        createdAt: daysAgo(40),
        updatedAt: daysAgo(12),
        lastVisitedAt: daysAgo(12),
      },
    ]

    await db.projects.bulkAdd(projects)

    const tasks: Task[] = [
      // ALT-001 Tasks (5 done, 3 remaining = 63%)
      {
        id: 't-101',
        projectId: 'proj-1',
        title: 'Define Dexie schema and version 1 table stores',
        status: 'done',
        priority: 'urgent',
        completedAt: daysAgo(7),
        createdAt: daysAgo(14),
        updatedAt: daysAgo(7),
        order: 0,
      },
      {
        id: 't-102',
        projectId: 'proj-1',
        title: 'Configure React hooks and useLiveQuery reactive listeners',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(5),
        createdAt: daysAgo(13),
        updatedAt: daysAgo(5),
        order: 1,
      },
      {
        id: 't-103',
        projectId: 'proj-1',
        title: 'Implement atomic transactions for cascading deletes',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(3),
        createdAt: daysAgo(12),
        updatedAt: daysAgo(3),
        order: 2,
      },
      {
        id: 't-104',
        projectId: 'proj-1',
        title: 'Benchmark IndexedDB write latency for bulk operations',
        status: 'done',
        priority: 'medium',
        completedAt: daysAgo(2),
        createdAt: daysAgo(10),
        updatedAt: daysAgo(2),
        order: 3,
      },
      {
        id: 't-105',
        projectId: 'proj-1',
        title: 'Add comprehensive demo seed generator and reset flow',
        status: 'done',
        priority: 'medium',
        completedAt: hoursAgo(4),
        createdAt: daysAgo(6),
        updatedAt: hoursAgo(4),
        order: 4,
      },
      {
        id: 't-106',
        projectId: 'proj-1',
        title: 'Implement Dexie sync layer with offline conflict resolution',
        status: 'in_progress',
        priority: 'urgent',
        dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        createdAt: daysAgo(4),
        updatedAt: minutesAgo(10),
        order: 5,
      },
      {
        id: 't-107',
        projectId: 'proj-1',
        title: 'Add web worker query offloading for large record sets',
        status: 'in_progress',
        priority: 'high',
        createdAt: daysAgo(2),
        updatedAt: hoursAgo(2),
        order: 6,
      },
      {
        id: 't-108',
        projectId: 'proj-1',
        title: 'Design export to SQLite / JSON backup format',
        status: 'todo',
        priority: 'medium',
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
        order: 7,
      },

      // ALT-002 Tasks (2 done, 4 remaining = 33%)
      {
        id: 't-201',
        projectId: 'proj-2',
        title: 'Create dark palette tokens and contrast verification matrix',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(6),
        createdAt: daysAgo(10),
        updatedAt: daysAgo(6),
        order: 0,
      },
      {
        id: 't-202',
        projectId: 'proj-2',
        title: 'Design responsive layout grids and typography scale',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(4),
        createdAt: daysAgo(9),
        updatedAt: daysAgo(4),
        order: 1,
      },
      {
        id: 't-203',
        projectId: 'proj-2',
        title: 'Review Figma handoff with product marketing team',
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        createdAt: daysAgo(3),
        updatedAt: hoursAgo(1),
        order: 2,
      },
      {
        id: 't-204',
        projectId: 'proj-2',
        title: 'Build interactive hero animation with CSS gradients',
        status: 'in_progress',
        priority: 'medium',
        createdAt: daysAgo(2),
        updatedAt: hoursAgo(3),
        order: 3,
      },
      {
        id: 't-205',
        projectId: 'proj-2',
        title: 'Write copy for product feature spotlights',
        status: 'todo',
        priority: 'medium',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
        order: 4,
      },
      {
        id: 't-206',
        projectId: 'proj-2',
        title: 'Integrate open-graph preview image generator',
        status: 'todo',
        priority: 'low',
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
        order: 5,
      },

      // ALT-003 Tasks (1 done, 5 remaining = 17%)
      {
        id: 't-301',
        projectId: 'proj-3',
        title: 'Audit existing REST endpoints and request payloads',
        status: 'done',
        priority: 'medium',
        completedAt: daysAgo(15),
        createdAt: daysAgo(20),
        updatedAt: daysAgo(15),
        order: 0,
      },
      {
        id: 't-302',
        projectId: 'proj-3',
        title: 'Outline OpenAPI 3.1 specification schema',
        status: 'todo',
        priority: 'high',
        createdAt: daysAgo(10),
        updatedAt: daysAgo(2),
        order: 1,
      },
      {
        id: 't-303',
        projectId: 'proj-3',
        title: 'Set up automated docs generation pipeline via TypeSpec',
        status: 'todo',
        priority: 'medium',
        createdAt: daysAgo(8),
        updatedAt: daysAgo(8),
        order: 2,
      },
      {
        id: 't-304',
        projectId: 'proj-3',
        title: 'Document webhook delivery lifecycle and retry policy',
        status: 'todo',
        priority: 'medium',
        createdAt: daysAgo(5),
        updatedAt: daysAgo(5),
        order: 3,
      },
      {
        id: 't-305',
        projectId: 'proj-3',
        title: 'Create Node.js and Python quickstart code snippets',
        status: 'todo',
        priority: 'low',
        createdAt: daysAgo(4),
        updatedAt: daysAgo(4),
        order: 4,
      },
      {
        id: 't-306',
        projectId: 'proj-3',
        title: 'Add interactive request runner sandbox',
        status: 'todo',
        priority: 'low',
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
        order: 5,
      },

      // ALT-004 Tasks (4 done, 1 remaining = 80%)
      {
        id: 't-401',
        projectId: 'proj-4',
        title: 'Compile Q3 performance metrics and milestone review',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(22),
        createdAt: daysAgo(30),
        updatedAt: daysAgo(22),
        order: 0,
      },
      {
        id: 't-402',
        projectId: 'proj-4',
        title: 'Draft core product themes and investment allocation',
        status: 'done',
        priority: 'urgent',
        completedAt: daysAgo(18),
        createdAt: daysAgo(28),
        updatedAt: daysAgo(18),
        order: 1,
      },
      {
        id: 't-403',
        projectId: 'proj-4',
        title: 'Gather team capacity forecasts across squads',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(12),
        createdAt: daysAgo(25),
        updatedAt: daysAgo(12),
        order: 2,
      },
      {
        id: 't-404',
        projectId: 'proj-4',
        title: 'Present draft plan to executive leadership',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(6),
        createdAt: daysAgo(15),
        updatedAt: daysAgo(6),
        order: 3,
      },
      {
        id: 't-405',
        projectId: 'proj-4',
        title: 'Finalize headcount numbers and budget signoff',
        status: 'todo',
        priority: 'urgent',
        createdAt: daysAgo(5),
        updatedAt: daysAgo(4),
        order: 4,
      },

      // ALT-005 Tasks (4 done, 3 remaining = 57%)
      {
        id: 't-501',
        projectId: 'proj-5',
        title: 'Map current customer signup churn points',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(6),
        createdAt: daysAgo(8),
        updatedAt: daysAgo(6),
        order: 0,
      },
      {
        id: 't-502',
        projectId: 'proj-5',
        title: 'Prototype 3-step interactive onboarding checklist',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(4),
        createdAt: daysAgo(7),
        updatedAt: daysAgo(4),
        order: 1,
      },
      {
        id: 't-503',
        projectId: 'proj-5',
        title: 'Conduct user testing session 1 (5 participants)',
        status: 'done',
        priority: 'medium',
        completedAt: daysAgo(2),
        createdAt: daysAgo(5),
        updatedAt: daysAgo(2),
        order: 2,
      },
      {
        id: 't-504',
        projectId: 'proj-5',
        title: 'Conduct user testing session 2 (iteration on copy)',
        status: 'done',
        priority: 'medium',
        completedAt: hoursAgo(18),
        createdAt: daysAgo(3),
        updatedAt: hoursAgo(18),
        order: 3,
      },
      {
        id: 't-505',
        projectId: 'proj-5',
        title: 'User test session 3 (focus on project templates)',
        status: 'in_progress',
        priority: 'urgent',
        dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
        createdAt: daysAgo(2),
        updatedAt: minutesAgo(30),
        order: 4,
      },
      {
        id: 't-506',
        projectId: 'proj-5',
        title: 'Implement animated celebration upon first completed task',
        status: 'in_progress',
        priority: 'low',
        createdAt: daysAgo(1),
        updatedAt: hoursAgo(2),
        order: 5,
      },
      {
        id: 't-507',
        projectId: 'proj-5',
        title: 'Telemetry integration for step completion analytics',
        status: 'todo',
        priority: 'medium',
        createdAt: hoursAgo(8),
        updatedAt: hoursAgo(8),
        order: 6,
      },

      // ALT-006 Tasks (4 done, 0 remaining = 100%)
      {
        id: 't-601',
        projectId: 'proj-6',
        title: 'Extract SQLite schema definition and relations',
        status: 'done',
        priority: 'medium',
        completedAt: daysAgo(18),
        createdAt: daysAgo(25),
        updatedAt: daysAgo(18),
        order: 0,
      },
      {
        id: 't-602',
        projectId: 'proj-6',
        title: 'Write JSON transformer script for task hierarchies',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(10),
        createdAt: daysAgo(20),
        updatedAt: daysAgo(10),
        order: 1,
      },
      {
        id: 't-603',
        projectId: 'proj-6',
        title: 'Test mock migration with 10,000 legacy records',
        status: 'done',
        priority: 'high',
        completedAt: daysAgo(5),
        createdAt: daysAgo(12),
        updatedAt: daysAgo(5),
        order: 2,
      },
      {
        id: 't-604',
        projectId: 'proj-6',
        title: 'Run production migration and verify hash parity',
        status: 'done',
        priority: 'urgent',
        completedAt: daysAgo(3),
        createdAt: daysAgo(6),
        updatedAt: daysAgo(3),
        order: 3,
      },

      // ALT-007 Tasks (1 done, 3 remaining = 25%)
      {
        id: 't-701',
        projectId: 'proj-7',
        title: 'Research mobile touch gesture frameworks',
        status: 'done',
        priority: 'medium',
        completedAt: daysAgo(35),
        createdAt: daysAgo(40),
        updatedAt: daysAgo(35),
        order: 0,
      },
      {
        id: 't-702',
        projectId: 'proj-7',
        title: 'Build swipe-to-complete prototype in sandbox',
        status: 'todo',
        priority: 'medium',
        createdAt: daysAgo(30),
        updatedAt: daysAgo(12),
        order: 1,
      },
      {
        id: 't-703',
        projectId: 'proj-7',
        title: 'Test drag and drop prioritization on iOS Safari',
        status: 'todo',
        priority: 'low',
        createdAt: daysAgo(28),
        updatedAt: daysAgo(12),
        order: 2,
      },
      {
        id: 't-704',
        projectId: 'proj-7',
        title: 'Benchmark pointer events touch cancellation latency',
        status: 'todo',
        priority: 'low',
        createdAt: daysAgo(25),
        updatedAt: daysAgo(12),
        order: 3,
      },
    ]

    await db.tasks.bulkAdd(tasks)

    const activities: Activity[] = [
      {
        id: generateId(),
        projectId: 'proj-1',
        type: 'next_action_set',
        description: 'Set next action: "Implement Dexie sync layer"',
        createdAt: minutesAgo(10),
      },
      {
        id: generateId(),
        projectId: 'proj-5',
        type: 'next_action_set',
        description: 'Set next action: "User test session 3"',
        createdAt: minutesAgo(30),
      },
      {
        id: generateId(),
        projectId: 'proj-2',
        type: 'next_action_set',
        description: 'Set next action: "Review Figma handoff"',
        createdAt: hoursAgo(1),
      },
      {
        id: generateId(),
        projectId: 'proj-1',
        taskId: 't-105',
        type: 'task_completed',
        description: 'Completed task "Add comprehensive demo seed generator and reset flow"',
        createdAt: hoursAgo(4),
      },
      {
        id: generateId(),
        projectId: 'proj-5',
        taskId: 't-504',
        type: 'task_completed',
        description: 'Completed task "Conduct user testing session 2 (iteration on copy)"',
        createdAt: hoursAgo(18),
      },
      {
        id: generateId(),
        projectId: 'proj-1',
        taskId: 't-104',
        type: 'task_completed',
        description: 'Completed task "Benchmark IndexedDB write latency for bulk operations"',
        createdAt: daysAgo(2),
      },
      {
        id: generateId(),
        projectId: 'proj-3',
        type: 'next_action_set',
        description: 'Set next action: "Outline OpenAPI spec"',
        createdAt: daysAgo(2),
      },
      {
        id: generateId(),
        projectId: 'proj-6',
        taskId: 't-604',
        type: 'task_completed',
        description: 'Completed task "Run production migration and verify hash parity"',
        createdAt: daysAgo(3),
      },
      {
        id: generateId(),
        projectId: 'proj-4',
        type: 'next_action_set',
        description: 'Set next action: "Finalize headcount numbers"',
        createdAt: daysAgo(4),
      },
      {
        id: generateId(),
        projectId: 'proj-4',
        taskId: 't-404',
        type: 'task_completed',
        description: 'Completed task "Present draft plan to executive leadership"',
        createdAt: daysAgo(6),
      },
      {
        id: generateId(),
        projectId: 'proj-5',
        type: 'project_created',
        description: 'Created project "Onboarding Flow" (ALT-005)',
        createdAt: daysAgo(8),
      },
      {
        id: generateId(),
        projectId: 'proj-2',
        type: 'project_created',
        description: 'Created project "Marketing Site Redesign" (ALT-002)',
        createdAt: daysAgo(10),
      },
      {
        id: generateId(),
        projectId: 'proj-1',
        type: 'project_created',
        description: 'Created project "ALTERA Core Engine" (ALT-001)',
        createdAt: daysAgo(14),
      },
    ]

    await db.activities.bulkAdd(activities)

    const sessions: Session[] = [
      {
        id: 'sess-1',
        projectId: 'proj-1',
        taskId: 't-101',
        title: 'IndexedDB schema migration and verification',
        objective: 'Implement Dexie v2 store definitions and test migration paths without resetting records.',
        status: 'completed',
        startedAt: hoursAgo(2),
        endedAt: minutesAgo(75),
        lastResumedAt: hoursAgo(2),
        accumulatedDurationMs: 45 * 60 * 1000, // 45m
        accomplishments: 'Configured Dexie version 2 store indexes and wrote test harness with fake-indexeddb.',
        blockers: 'None',
        nextStep: 'Connect reactive queries in session hooks',
        outcome: 'completed',
        createdAt: hoursAgo(2),
        updatedAt: minutesAgo(75),
      },
      {
        id: 'sess-2',
        projectId: 'proj-2',
        taskId: 't-201',
        title: 'Hero typography and contrast audit',
        objective: 'Align dark palette tokens with Linear density aesthetics.',
        status: 'completed',
        startedAt: hoursAgo(5),
        endedAt: hoursAgo(4.5),
        lastResumedAt: hoursAgo(5),
        accumulatedDurationMs: 30 * 60 * 1000, // 30m
        accomplishments: 'Refined CSS variables and verified contrast ratios in dark mode across browsers.',
        blockers: 'Awaiting final SVG illustrations from brand design.',
        nextStep: 'Incorporate carousel animations',
        outcome: 'progress',
        createdAt: hoursAgo(5),
        updatedAt: hoursAgo(4.5),
      },
      {
        id: 'sess-3',
        projectId: 'proj-1',
        title: 'Session state machine & reliable timer',
        objective: 'Design timestamp-based timer logic that survives page navigation and tab backgrounding.',
        status: 'completed',
        startedAt: daysAgo(1),
        endedAt: new Date(daysAgo(1).getTime() + 60 * 60 * 1000),
        lastResumedAt: daysAgo(1),
        accumulatedDurationMs: 60 * 60 * 1000, // 1h
        accomplishments: 'Created pure duration derivation and state transitions with atomic transactions.',
        blockers: 'None',
        nextStep: 'Add unit tests for overlapping session prevention',
        outcome: 'completed',
        createdAt: daysAgo(1),
        updatedAt: new Date(daysAgo(1).getTime() + 60 * 60 * 1000),
      },
      {
        id: 'sess-4',
        projectId: 'proj-5',
        title: 'User testing session synthesis',
        objective: 'Synthesize findings from participant walkthrough sessions.',
        status: 'completed',
        startedAt: daysAgo(3),
        endedAt: new Date(daysAgo(3).getTime() + 40 * 60 * 1000),
        lastResumedAt: daysAgo(3),
        accumulatedDurationMs: 40 * 60 * 1000, // 40m
        accomplishments: 'Identified friction point in project creation modal and clarified field helper text.',
        blockers: 'None',
        nextStep: 'Simplify default next action field in dialog',
        outcome: 'completed',
        createdAt: daysAgo(3),
        updatedAt: new Date(daysAgo(3).getTime() + 40 * 60 * 1000),
      },
    ]

    await db.sessions.bulkAdd(sessions)

    // ── Knowledge Hub Seed Data ──────────────────────────────────────────
    const tags: Tag[] = [
      {
        id: 'tag-arch',
        name: 'architecture',
        normalizedName: 'architecture',
        color: '#3b82f6',
        createdAt: daysAgo(14),
      },
      {
        id: 'tag-db',
        name: 'database',
        normalizedName: 'database',
        color: '#22c55e',
        createdAt: daysAgo(14),
      },
      {
        id: 'tag-front',
        name: 'frontend',
        normalizedName: 'frontend',
        color: '#8b5cf6',
        createdAt: daysAgo(10),
      },
      {
        id: 'tag-specs',
        name: 'specs',
        normalizedName: 'specs',
        color: '#f59e0b',
        createdAt: daysAgo(8),
      },
      {
        id: 'tag-research',
        name: 'research',
        normalizedName: 'research',
        color: '#06b6d4',
        createdAt: daysAgo(5),
      },
    ]

    await db.tags.bulkAdd(tags)

    const notes: Note[] = [
      {
        id: 'note-1',
        title: 'ALTERA Architecture & Local-First Philosophy',
        projectId: 'proj-1',
        isFavorite: true,
        revision: 1,
        createdAt: daysAgo(12),
        updatedAt: hoursAgo(2),
        contentJSON: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'ALTERA Architecture & Local-First Philosophy' }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'ALTERA is architected from the ground up as a ' },
                { type: 'text', marks: [{ type: 'bold' }], text: 'local-first' },
                {
                  type: 'text',
                  text: ' personal productivity system. All primary data structures live inside client-side IndexedDB, offering sub-millisecond query responses and complete offline autonomy.',
                },
              ],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Core Principles' }],
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', text: 'Zero-latency UI updates powered by Dexie live queries.' },
                      ],
                    },
                  ],
                },
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: 'Seamless continuity across work sessions and uninterrupted offline workflow.',
                        },
                      ],
                    },
                  ],
                },
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: 'Strict client-side data sovereignty without external telemetry or mandatory accounts.',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'blockquote',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'The fastest request is the one that never touches the network.',
                    },
                  ],
                },
              ],
            },
          ],
        }),
        plainText:
          'ALTERA Architecture & Local-First Philosophy\n\nALTERA is architected from the ground up as a local-first personal productivity system. All primary data structures live inside client-side IndexedDB, offering sub-millisecond query responses and complete offline autonomy.\n\nCore Principles:\n- Zero-latency UI updates powered by Dexie live queries.\n- Seamless continuity across work sessions and uninterrupted offline workflow.\n- Strict client-side data sovereignty without external telemetry or mandatory accounts.\n\n"The fastest request is the one that never touches the network."',
      },
      {
        id: 'note-2',
        title: 'Dexie.js v3 Schema & Transaction Guidelines',
        projectId: 'proj-1',
        isFavorite: true,
        revision: 1,
        createdAt: daysAgo(6),
        updatedAt: hoursAgo(4),
        contentJSON: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Dexie.js v3 Schema & Transaction Guidelines' }],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'IndexedDB migrations must remain non-destructive across versions. Version 3 expands ALTERA with dedicated stores for notes, resources, attachments, tags, tagAssignments, and entityLinks.',
                },
              ],
            },
            {
              type: 'codeBlock',
              attrs: { language: 'typescript' },
              content: [
                {
                  type: 'text',
                  text: "export async function safeKnowledgeTransaction<T>(fn: () => Promise<T>): Promise<T> {\n  return db.transaction('rw', [db.notes, db.tags, db.tagAssignments, db.entityLinks], fn)\n}",
                },
              ],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Migration Checklist' }],
            },
            {
              type: 'taskList',
              content: [
                {
                  type: 'taskItem',
                  attrs: { checked: true },
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: 'Preserve v1 and v2 Dexie store definitions without modification',
                        },
                      ],
                    },
                  ],
                },
                {
                  type: 'taskItem',
                  attrs: { checked: true },
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: 'Define compound indexes for bidirectional relationship queries',
                        },
                      ],
                    },
                  ],
                },
                {
                  type: 'taskItem',
                  attrs: { checked: false },
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: 'Verify export/import round-trip with Blob attachments',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        plainText:
          'Dexie.js v3 Schema & Transaction Guidelines\n\nIndexedDB migrations must remain non-destructive across versions. Version 3 expands ALTERA with dedicated stores for notes, resources, attachments, tags, tagAssignments, and entityLinks.\n\nMigration Checklist:\n[x] Preserve v1 and v2 Dexie store definitions without modification\n[x] Define compound indexes for bidirectional relationship queries\n[ ] Verify export/import round-trip with Blob attachments',
      },
      {
        id: 'note-3',
        title: 'Marketing Site Styleguide & Motion Tokens',
        projectId: 'proj-2',
        isFavorite: false,
        revision: 1,
        createdAt: daysAgo(4),
        updatedAt: hoursAgo(6),
        contentJSON: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Marketing Site Styleguide & Motion Tokens' }],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Visual guidelines for the dark aesthetic of the ALTERA landing experience. High contrast monochrome palette with purposeful vibrant accent highlights.',
                },
              ],
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Base surface: #0d0d0f (Pure dark charcoal)' }],
                    },
                  ],
                },
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Cards elevated: #18181b with 1px #2a2a2d border' }],
                    },
                  ],
                },
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', text: 'Spring animations: 180ms cubic-bezier(0.16, 1, 0.3, 1)' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        plainText:
          'Marketing Site Styleguide & Motion Tokens\n\nVisual guidelines for the dark aesthetic of the ALTERA landing experience. High contrast monochrome palette with purposeful vibrant accent highlights.\n- Base surface: #0d0d0f\n- Cards elevated: #18181b\n- Spring animations: 180ms ease-out',
      },
      {
        id: 'note-4',
        title: 'Onboarding Flow Friction Analysis',
        projectId: 'proj-5',
        isFavorite: false,
        revision: 1,
        createdAt: daysAgo(2),
        updatedAt: hoursAgo(8),
        contentJSON: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Onboarding Flow Friction Analysis' }],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Summary of user testing sessions evaluating time-to-first-project creation and keyboard shortcut discoverability.',
                },
              ],
            },
            {
              type: 'taskList',
              content: [
                {
                  type: 'taskItem',
                  attrs: { checked: true },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Evaluate friction during template preselection' }],
                    },
                  ],
                },
                {
                  type: 'taskItem',
                  attrs: { checked: true },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Provide clear visual feedback when next action is set' }],
                    },
                  ],
                },
                {
                  type: 'taskItem',
                  attrs: { checked: false },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Add tooltip hints for ⌘K and / command palette' }],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        plainText:
          'Onboarding Flow Friction Analysis\n\nSummary of user testing sessions evaluating time-to-first-project creation and keyboard shortcut discoverability.\n[x] Evaluate friction during template preselection\n[x] Provide clear visual feedback when next action is set\n[ ] Add tooltip hints for ⌘K and / command palette',
      },
    ]

    await db.notes.bulkAdd(notes)

    const resources: Resource[] = [
      {
        id: 'res-1',
        type: 'link',
        title: 'Dexie.js Official Documentation',
        description: 'Reactive IndexedDB wrapper API reference, queries, and transaction best practices.',
        url: 'https://dexie.org/docs/',
        projectId: 'proj-1',
        isFavorite: true,
        createdAt: daysAgo(10),
        updatedAt: daysAgo(5),
      },
      {
        id: 'res-2',
        type: 'link',
        title: 'Tailwind CSS Documentation',
        description: 'Utility-first CSS framework class and customization guides.',
        url: 'https://tailwindcss.com/docs',
        projectId: 'proj-2',
        isFavorite: false,
        createdAt: daysAgo(8),
        updatedAt: daysAgo(3),
      },
      {
        id: 'res-3',
        type: 'snippet',
        title: 'Debounced Autosave Hook',
        description: 'Custom React hook for debouncing note editor persistence with revision guards.',
        snippetContent: `import * as React from 'react'\n\nexport function useDebounce<T>(value: T, delay: number): T {\n  const [debouncedValue, setDebouncedValue] = React.useState(value)\n  React.useEffect(() => {\n    const handler = setTimeout(() => setDebouncedValue(value), delay)\n    return () => clearTimeout(handler)\n  }, [value, delay])\n  return debouncedValue\n}`,
        language: 'typescript',
        projectId: 'proj-1',
        isFavorite: true,
        createdAt: daysAgo(6),
        updatedAt: daysAgo(2),
      },
      {
        id: 'res-4',
        type: 'snippet',
        title: 'Sanitize Safe Link Protocol',
        description: 'Guards against javascript: and data: XSS link payloads.',
        snippetContent: `export function isSafeUrl(rawUrl: string): boolean {\n  try {\n    const parsed = new URL(rawUrl, 'https://altera.local')\n    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol)\n  } catch {\n    return false\n  }\n}`,
        language: 'typescript',
        projectId: 'proj-1',
        isFavorite: false,
        createdAt: daysAgo(4),
        updatedAt: daysAgo(1),
      },
    ]

    await db.resources.bulkAdd(resources)

    const tagAssignments: TagAssignment[] = [
      { id: 'ta-1', tagId: 'tag-arch', entityType: 'note', entityId: 'note-1' },
      { id: 'ta-2', tagId: 'tag-specs', entityType: 'note', entityId: 'note-1' },
      { id: 'ta-3', tagId: 'tag-db', entityType: 'note', entityId: 'note-2' },
      { id: 'ta-4', tagId: 'tag-arch', entityType: 'note', entityId: 'note-2' },
      { id: 'ta-5', tagId: 'tag-front', entityType: 'note', entityId: 'note-3' },
      { id: 'ta-6', tagId: 'tag-research', entityType: 'note', entityId: 'note-4' },
      { id: 'ta-7', tagId: 'tag-db', entityType: 'resource', entityId: 'res-1' },
      { id: 'ta-8', tagId: 'tag-front', entityType: 'resource', entityId: 'res-3' },
    ]

    await db.tagAssignments.bulkAdd(tagAssignments)

    const entityLinks: EntityLink[] = [
      {
        id: 'el-1',
        sourceType: 'note',
        sourceId: 'note-1',
        targetType: 'project',
        targetId: 'proj-1',
        createdAt: daysAgo(12),
      },
      {
        id: 'el-2',
        sourceType: 'note',
        sourceId: 'note-2',
        targetType: 'project',
        targetId: 'proj-1',
        createdAt: daysAgo(6),
      },
      {
        id: 'el-3',
        sourceType: 'note',
        sourceId: 'note-3',
        targetType: 'project',
        targetId: 'proj-2',
        createdAt: daysAgo(4),
      },
      {
        id: 'el-4',
        sourceType: 'note',
        sourceId: 'note-4',
        targetType: 'project',
        targetId: 'proj-5',
        createdAt: daysAgo(2),
      },
      {
        id: 'el-5',
        sourceType: 'resource',
        sourceId: 'res-1',
        targetType: 'project',
        targetId: 'proj-1',
        createdAt: daysAgo(10),
      },
      {
        id: 'el-6',
        sourceType: 'resource',
        sourceId: 'res-3',
        targetType: 'project',
        targetId: 'proj-1',
        createdAt: daysAgo(6),
      },
      {
        id: 'el-7',
        sourceType: 'note',
        sourceId: 'note-2',
        targetType: 'resource',
        targetId: 'res-1',
        createdAt: daysAgo(5),
      },
    ]

    await db.entityLinks.bulkAdd(entityLinks)
  })
}

export { ensureDatabaseSeeded } from './initialization'
