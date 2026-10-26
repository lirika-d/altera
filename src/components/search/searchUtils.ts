/**
 * searchUtils.ts — Local Deterministic Multi-Entity Search Indexer for ALTERA
 *
 * Provides client-side indexing, scoring, match highlighting, snippet extraction,
 * and type filtering across 5 core entity types:
 *   1. Projects: name, identifier, description, nextAction
 *   2. Tasks: title, identifier, status, priority, project name
 *   3. Sessions: title, objective, accomplishments, outcome
 *   4. Notes: title, plainText content (first 300 chars preview)
 *   5. Resources: title, description, url, snippetContent
 *
 * Relevance ranking tier:
 *   exact title match (1000) >
 *   exact identifier match (900) >
 *   prefix title match (800 / 700) >
 *   prefix identifier match (750) >
 *   substring match in title (500) >
 *   substring identifier match (450) >
 *   substring secondary field match (300) >
 *   word prefix in content/description (150) >
 *   substring match in content/description (100)
 */

import type { Project, Task, Session, Note, Resource } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchEntityType = 'project' | 'task' | 'session' | 'note' | 'resource'

export type SearchFilterType = 'all' | 'projects' | 'tasks' | 'sessions' | 'notes' | 'resources'

export interface SearchResultMetadata {
  status?: string
  priority?: string
  projectName?: string
  projectId?: string
  date?: Date
  durationMs?: number
  url?: string
  resourceType?: string
  language?: string
  nextAction?: string
  isFavorite?: boolean
  [key: string]: unknown
}

export interface SearchResultItem {
  id: string
  type: SearchEntityType
  title: string
  identifier?: string
  subtitle?: string
  snippet?: string
  score: number
  matchedField?: string
  metadata: SearchResultMetadata
  rawItem: Project | Task | Session | Note | Resource
}

export interface SearchCounts {
  all: number
  projects: number
  tasks: number
  sessions: number
  notes: number
  resources: number
}

export interface SearchData {
  projects?: Project[]
  tasks?: Task[]
  sessions?: Session[]
  notes?: Note[]
  resources?: Resource[]
}

export interface SearchEntitiesOptions {
  query: string
  filter?: SearchFilterType
  data: SearchData
  maxResults?: number
  allowEmptyQuery?: boolean
}

export interface TextSegment {
  text: string
  isMatch: boolean
}

// ─── Score Weights ────────────────────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  EXACT_TITLE: 1000,
  EXACT_IDENTIFIER: 900,
  PREFIX_TITLE: 800,
  PREFIX_IDENTIFIER: 750,
  WORD_PREFIX_TITLE: 700,
  SUBSTRING_TITLE: 500,
  SUBSTRING_IDENTIFIER: 450,
  SUBSTRING_SECONDARY: 300,
  WORD_PREFIX_CONTENT: 150,
  SUBSTRING_CONTENT: 100,
} as const

// ─── Scoring Engine ───────────────────────────────────────────────────────────

/**
 * Calculates score for a field against query string.
 * Returns 0 if no match.
 */
export function scoreField(
  value: string | undefined | null,
  query: string,
  fieldType: 'title' | 'identifier' | 'secondary' | 'content'
): number {
  if (!value || !query) return 0
  const val = value.trim()
  const q = query.trim()
  if (!val || !q) return 0

  const lowerVal = val.toLowerCase()
  const lowerQ = q.toLowerCase()

  if (fieldType === 'title') {
    // Exact title match
    if (lowerVal === lowerQ) return SCORE_WEIGHTS.EXACT_TITLE
    // Prefix match
    if (lowerVal.startsWith(lowerQ)) return SCORE_WEIGHTS.PREFIX_TITLE
    // Word prefix match
    const words = lowerVal.split(/[\s\-_/.,;:|()]+/)
    if (words.some((w) => w.startsWith(lowerQ))) return SCORE_WEIGHTS.WORD_PREFIX_TITLE
    // Substring match
    if (lowerVal.includes(lowerQ)) return SCORE_WEIGHTS.SUBSTRING_TITLE
    return 0
  }

  if (fieldType === 'identifier') {
    // Exact identifier match
    if (lowerVal === lowerQ) return SCORE_WEIGHTS.EXACT_IDENTIFIER
    // Prefix match
    if (lowerVal.startsWith(lowerQ)) return SCORE_WEIGHTS.PREFIX_IDENTIFIER
    // Substring match
    if (lowerVal.includes(lowerQ)) return SCORE_WEIGHTS.SUBSTRING_IDENTIFIER
    return 0
  }

  if (fieldType === 'secondary') {
    // e.g. project name for task, or resource URL
    if (lowerVal === lowerQ) return SCORE_WEIGHTS.SUBSTRING_SECONDARY + 100
    if (lowerVal.startsWith(lowerQ)) return SCORE_WEIGHTS.SUBSTRING_SECONDARY + 50
    if (lowerVal.includes(lowerQ)) return SCORE_WEIGHTS.SUBSTRING_SECONDARY
    return 0
  }

  if (fieldType === 'content') {
    // Description, plainText, accomplishments, outcome, etc.
    const words = lowerVal.split(/[\s\-_/.,;:|()]+/)
    if (words.some((w) => w.startsWith(lowerQ))) return SCORE_WEIGHTS.WORD_PREFIX_CONTENT
    if (lowerVal.includes(lowerQ)) return SCORE_WEIGHTS.SUBSTRING_CONTENT
    return 0
  }

  return 0
}

// ─── Snippet Extraction ───────────────────────────────────────────────────────

/**
 * Extracts a contextual snippet around a query match, or truncates text
 * to maxLength (default 300) with clean ellipsis.
 */
export function extractSnippet(
  text?: string | null,
  query?: string,
  maxLength: number = 300
): string {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''

  if (!query || !query.trim()) {
    if (clean.length <= maxLength) return clean
    return clean.slice(0, maxLength).trimEnd() + '…'
  }

  const q = query.trim().toLowerCase()
  const lower = clean.toLowerCase()
  const matchIndex = lower.indexOf(q)

  if (matchIndex === -1) {
    if (clean.length <= maxLength) return clean
    return clean.slice(0, maxLength).trimEnd() + '…'
  }

  if (clean.length <= maxLength) {
    return clean
  }

  // Calculate window around matchIndex with leading context
  const contextBefore = Math.min(matchIndex, 40)
  let start = matchIndex - contextBefore
  let end = start + maxLength

  if (end > clean.length) {
    end = clean.length
    start = Math.max(0, end - maxLength)
  }

  let snippet = clean.slice(start, end)
  if (start > 0) {
    snippet = '…' + snippet.trimStart()
  }
  if (end < clean.length) {
    snippet = snippet.trimEnd() + '…'
  }

  return snippet
}

// ─── Match Highlighting ───────────────────────────────────────────────────────

/**
 * Splits text into segments indicating whether each part matches query.
 * Safe against regex injection (pure string indices).
 */
export function highlightMatches(text?: string | null, query?: string): TextSegment[] {
  if (!text) return []
  if (!query || !query.trim()) {
    return [{ text, isMatch: false }]
  }

  const q = query.trim()
  const lowerText = text.toLowerCase()
  const lowerQ = q.toLowerCase()

  const segments: TextSegment[] = []
  let lastIndex = 0
  let index = lowerText.indexOf(lowerQ, lastIndex)

  while (index !== -1) {
    if (index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, index),
        isMatch: false,
      })
    }
    segments.push({
      text: text.slice(index, index + q.length),
      isMatch: true,
    })
    lastIndex = index + q.length
    index = lowerText.indexOf(lowerQ, lastIndex)
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isMatch: false,
    })
  }

  return segments
}

// ─── Individual Entity Matchers ───────────────────────────────────────────────

/**
 * Searches Projects:
 * Matches on name, identifier, description, nextAction.
 */
export function searchProjects(projects: Project[] = [], query: string): SearchResultItem[] {
  const trimmed = query.trim()
  const results: SearchResultItem[] = []

  for (const project of projects) {
    if (!trimmed) {
      results.push({
        id: project.id,
        type: 'project',
        title: project.name,
        identifier: project.identifier,
        subtitle: project.identifier,
        snippet: extractSnippet(project.description || project.nextAction, '', 300),
        score: 0,
        metadata: {
          status: project.status,
          priority: project.priority,
          color: project.color,
          icon: project.icon,
          progress: project.progress,
          nextAction: project.nextAction,
          date: project.updatedAt,
        },
        rawItem: project,
      })
      continue
    }

    const titleScore = scoreField(project.name, trimmed, 'title')
    const idScore = scoreField(project.identifier, trimmed, 'identifier')
    const descScore = scoreField(project.description, trimmed, 'content')
    const nextActionScore = scoreField(project.nextAction, trimmed, 'content')

    const maxScore = Math.max(titleScore, idScore, descScore, nextActionScore)
    if (maxScore > 0) {
      // Content match bonus without breaking tiers
      const bonus = (descScore > 0 || nextActionScore > 0) && (titleScore > 0 || idScore > 0) ? 20 : 0
      const finalScore = maxScore + bonus

      let snippetText = project.description
      let matchedField = 'name'
      if (titleScore > 0) matchedField = 'name'
      else if (idScore > 0) matchedField = 'identifier'
      else if (descScore > 0) {
        matchedField = 'description'
        snippetText = project.description
      } else if (nextActionScore > 0) {
        matchedField = 'nextAction'
        snippetText = project.nextAction
      }

      results.push({
        id: project.id,
        type: 'project',
        title: project.name,
        identifier: project.identifier,
        subtitle: project.identifier,
        snippet: extractSnippet(snippetText, trimmed, 300),
        score: finalScore,
        matchedField,
        metadata: {
          status: project.status,
          priority: project.priority,
          color: project.color,
          icon: project.icon,
          progress: project.progress,
          nextAction: project.nextAction,
          date: project.updatedAt,
        },
        rawItem: project,
      })
    }
  }

  return results
}

/**
 * Searches Tasks:
 * Matches on title, identifier, status, priority, project name.
 */
export function searchTasks(
  tasks: Task[] = [],
  query: string,
  projects: Project[] = []
): SearchResultItem[] {
  const trimmed = query.trim()
  const results: SearchResultItem[] = []
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]))

  for (const task of tasks) {
    const project = projectMap.get(task.projectId)
    const projectName = project?.name || ''
    const identifier = project?.identifier || 'Task'

    if (!trimmed) {
      results.push({
        id: task.id,
        type: 'task',
        title: task.title,
        identifier,
        subtitle: projectName,
        snippet: projectName ? `Project: ${projectName}` : undefined,
        score: 0,
        metadata: {
          status: task.status,
          priority: task.priority,
          projectName,
          projectId: task.projectId,
          date: task.updatedAt,
        },
        rawItem: task,
      })
      continue
    }

    const titleScore = scoreField(task.title, trimmed, 'title')
    const idScore = scoreField(identifier, trimmed, 'identifier')
    const projScore = scoreField(projectName, trimmed, 'secondary')
    const statusScore = scoreField(task.status, trimmed, 'content')
    const priorityScore = scoreField(task.priority, trimmed, 'content')

    const maxScore = Math.max(titleScore, idScore, projScore, statusScore, priorityScore)
    if (maxScore > 0) {
      const bonus = projScore > 0 && titleScore > 0 ? 15 : 0
      const finalScore = maxScore + bonus

      let matchedField = 'title'
      if (titleScore > 0) matchedField = 'title'
      else if (idScore > 0) matchedField = 'identifier'
      else if (projScore > 0) matchedField = 'project'
      else if (statusScore > 0) matchedField = 'status'
      else if (priorityScore > 0) matchedField = 'priority'

      const snippet = projectName ? `Project: ${projectName}` : undefined

      results.push({
        id: task.id,
        type: 'task',
        title: task.title,
        identifier,
        subtitle: projectName,
        snippet,
        score: finalScore,
        matchedField,
        metadata: {
          status: task.status,
          priority: task.priority,
          projectName,
          projectId: task.projectId,
          date: task.updatedAt,
        },
        rawItem: task,
      })
    }
  }

  return results
}

/**
 * Searches Sessions:
 * Matches on title, objective, accomplishments, outcome.
 */
export function searchSessions(
  sessions: Session[] = [],
  query: string,
  projects: Project[] = []
): SearchResultItem[] {
  const trimmed = query.trim()
  const results: SearchResultItem[] = []
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]))

  for (const session of sessions) {
    const project = projectMap.get(session.projectId)
    const projectName = project?.name || ''
    const identifier = project?.identifier

    if (!trimmed) {
      results.push({
        id: session.id,
        type: 'session',
        title: session.title || 'Work Session',
        identifier,
        subtitle: projectName,
        snippet: extractSnippet(
          session.accomplishments || session.objective || session.outcome,
          '',
          300
        ),
        score: 0,
        metadata: {
          status: session.status,
          projectName,
          projectId: session.projectId,
          durationMs: session.accumulatedDurationMs,
          date: session.startedAt,
          outcome: session.outcome,
          nextStep: session.nextStep,
        },
        rawItem: session,
      })
      continue
    }

    const titleScore = scoreField(session.title, trimmed, 'title')
    const objScore = scoreField(session.objective, trimmed, 'content')
    const accompScore = scoreField(session.accomplishments, trimmed, 'content')
    const outcomeScore = scoreField(session.outcome, trimmed, 'content')
    const nextStepScore = scoreField(session.nextStep, trimmed, 'content')
    const projScore = scoreField(projectName, trimmed, 'secondary')

    const maxScore = Math.max(
      titleScore,
      objScore,
      accompScore,
      outcomeScore,
      nextStepScore,
      projScore
    )

    if (maxScore > 0) {
      const bonus = (accompScore > 0 || objScore > 0) && titleScore > 0 ? 20 : 0
      const finalScore = maxScore + bonus

      let snippetText = session.accomplishments || session.objective || session.outcome || ''
      let matchedField = 'title'

      if (titleScore > 0) matchedField = 'title'
      else if (projScore > 0) matchedField = 'project'
      else if (accompScore > 0) {
        matchedField = 'accomplishments'
        snippetText = session.accomplishments
      } else if (objScore > 0) {
        matchedField = 'objective'
        snippetText = session.objective
      } else if (outcomeScore > 0) {
        matchedField = 'outcome'
        snippetText = session.outcome
      } else if (nextStepScore > 0) {
        matchedField = 'nextStep'
        snippetText = session.nextStep
      }

      results.push({
        id: session.id,
        type: 'session',
        title: session.title || 'Work Session',
        identifier,
        subtitle: projectName,
        snippet: extractSnippet(snippetText, trimmed, 300),
        score: finalScore,
        matchedField,
        metadata: {
          status: session.status,
          projectName,
          projectId: session.projectId,
          durationMs: session.accumulatedDurationMs,
          date: session.startedAt,
          outcome: session.outcome,
          nextStep: session.nextStep,
        },
        rawItem: session,
      })
    }
  }

  return results
}

/**
 * Searches Notes:
 * Matches on title, plainText content (first 300 chars preview).
 */
export function searchNotes(
  notes: Note[] = [],
  query: string,
  projects: Project[] = []
): SearchResultItem[] {
  const trimmed = query.trim()
  const results: SearchResultItem[] = []
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]))

  for (const note of notes) {
    if (note.deletedAt) continue // skip soft-deleted notes

    const project = note.projectId ? projectMap.get(note.projectId) : undefined
    const projectName = project?.name
    const identifier = project?.identifier

    if (!trimmed) {
      results.push({
        id: note.id,
        type: 'note',
        title: note.title || 'Untitled Note',
        identifier,
        subtitle: projectName,
        snippet: extractSnippet(note.plainText, '', 300),
        score: 0,
        metadata: {
          projectId: note.projectId,
          projectName,
          isFavorite: note.isFavorite,
          date: note.updatedAt,
        },
        rawItem: note,
      })
      continue
    }

    const titleScore = scoreField(note.title, trimmed, 'title')
    const contentScore = scoreField(note.plainText, trimmed, 'content')
    const projScore = projectName ? scoreField(projectName, trimmed, 'secondary') : 0

    const maxScore = Math.max(titleScore, contentScore, projScore)
    if (maxScore > 0) {
      const bonus = contentScore > 0 && titleScore > 0 ? 20 : 0
      const finalScore = maxScore + bonus

      let matchedField = 'title'
      if (titleScore > 0) matchedField = 'title'
      else if (contentScore > 0) matchedField = 'plainText'
      else if (projScore > 0) matchedField = 'project'

      results.push({
        id: note.id,
        type: 'note',
        title: note.title || 'Untitled Note',
        identifier,
        subtitle: projectName,
        snippet: extractSnippet(note.plainText, trimmed, 300),
        score: finalScore,
        matchedField,
        metadata: {
          projectId: note.projectId,
          projectName,
          isFavorite: note.isFavorite,
          date: note.updatedAt,
        },
        rawItem: note,
      })
    }
  }

  return results
}

/**
 * Searches Resources:
 * Matches on title, description, url, snippetContent.
 */
export function searchResources(
  resources: Resource[] = [],
  query: string,
  projects: Project[] = []
): SearchResultItem[] {
  const trimmed = query.trim()
  const results: SearchResultItem[] = []
  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]))

  for (const resource of resources) {
    if (resource.deletedAt) continue // skip soft-deleted resources

    const project = resource.projectId ? projectMap.get(resource.projectId) : undefined
    const projectName = project?.name
    const identifier = project?.identifier

    if (!trimmed) {
      results.push({
        id: resource.id,
        type: 'resource',
        title: resource.title,
        identifier,
        subtitle: resource.url || resource.language || projectName,
        snippet: extractSnippet(resource.description || resource.snippetContent, '', 300),
        score: 0,
        metadata: {
          resourceType: resource.type,
          url: resource.url,
          language: resource.language,
          description: resource.description,
          snippetContent: resource.snippetContent,
          isFavorite: resource.isFavorite,
          projectId: resource.projectId,
          projectName,
          date: resource.updatedAt,
        },
        rawItem: resource,
      })
      continue
    }

    const titleScore = scoreField(resource.title, trimmed, 'title')
    const descScore = scoreField(resource.description, trimmed, 'content')
    const urlScore = scoreField(resource.url, trimmed, 'secondary')
    const snippetScore = scoreField(resource.snippetContent, trimmed, 'content')
    const projScore = projectName ? scoreField(projectName, trimmed, 'secondary') : 0

    const maxScore = Math.max(titleScore, descScore, urlScore, snippetScore, projScore)
    if (maxScore > 0) {
      const bonus = (descScore > 0 || snippetScore > 0) && titleScore > 0 ? 20 : 0
      const finalScore = maxScore + bonus

      let snippetText = resource.description || resource.snippetContent || ''
      let matchedField = 'title'

      if (titleScore > 0) matchedField = 'title'
      else if (urlScore > 0) matchedField = 'url'
      else if (snippetScore > 0) {
        matchedField = 'snippetContent'
        snippetText = resource.snippetContent || ''
      } else if (descScore > 0) {
        matchedField = 'description'
        snippetText = resource.description || ''
      } else if (projScore > 0) {
        matchedField = 'project'
      }

      results.push({
        id: resource.id,
        type: 'resource',
        title: resource.title,
        identifier,
        subtitle: resource.url || resource.language || projectName,
        snippet: extractSnippet(snippetText, trimmed, 300),
        score: finalScore,
        matchedField,
        metadata: {
          resourceType: resource.type,
          url: resource.url,
          language: resource.language,
          description: resource.description,
          snippetContent: resource.snippetContent,
          isFavorite: resource.isFavorite,
          projectId: resource.projectId,
          projectName,
          date: resource.updatedAt,
        },
        rawItem: resource,
      })
    }
  }

  return results
}

// ─── Deterministic Tie-Breaker Sorting ────────────────────────────────────────

export function compareSearchResults(a: SearchResultItem, b: SearchResultItem): number {
  if (b.score !== a.score) {
    return b.score - a.score
  }
  // Secondary: shorter title is more relevant
  if (a.title.length !== b.title.length) {
    return a.title.length - b.title.length
  }
  // Tertiary: more recent date
  const dateA = a.metadata.date ? new Date(a.metadata.date).getTime() : 0
  const dateB = b.metadata.date ? new Date(b.metadata.date).getTime() : 0
  if (dateB !== dateA) {
    return dateB - dateA
  }
  // Deterministic final fallback
  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
}

// ─── Counts Calculation ───────────────────────────────────────────────────────

/**
 * Computes match counts for each filter category for a query.
 */
export function getSearchCounts(data: SearchData, query: string): SearchCounts {
  const trimmed = query.trim()
  const projects = data.projects || []
  const tasks = data.tasks || []
  const sessions = data.sessions || []
  const notes = (data.notes || []).filter((n) => !n.deletedAt)
  const resources = (data.resources || []).filter((r) => !r.deletedAt)

  if (!trimmed) {
    return {
      all: projects.length + tasks.length + sessions.length + notes.length + resources.length,
      projects: projects.length,
      tasks: tasks.length,
      sessions: sessions.length,
      notes: notes.length,
      resources: resources.length,
    }
  }

  const pCount = searchProjects(projects, trimmed).length
  const tCount = searchTasks(tasks, trimmed, projects).length
  const sCount = searchSessions(sessions, trimmed, projects).length
  const nCount = searchNotes(notes, trimmed, projects).length
  const rCount = searchResources(resources, trimmed, projects).length

  return {
    all: pCount + tCount + sCount + nCount + rCount,
    projects: pCount,
    tasks: tCount,
    sessions: sCount,
    notes: nCount,
    resources: rCount,
  }
}

// ─── Main Unified Search Function ─────────────────────────────────────────────

/**
 * Searches across all 5 entity types and returns deterministically sorted results.
 */
export function searchEntities(options: SearchEntitiesOptions): SearchResultItem[] {
  const { query, filter = 'all', data, maxResults = 50, allowEmptyQuery = false } = options
  const trimmed = query.trim()

  if (!trimmed && !allowEmptyQuery) {
    return []
  }

  const projects = data.projects || []
  const tasks = data.tasks || []
  const sessions = data.sessions || []
  const notes = data.notes || []
  const resources = data.resources || []

  let results: SearchResultItem[] = []

  switch (filter) {
    case 'projects':
      results = searchProjects(projects, trimmed)
      break
    case 'tasks':
      results = searchTasks(tasks, trimmed, projects)
      break
    case 'sessions':
      results = searchSessions(sessions, trimmed, projects)
      break
    case 'notes':
      results = searchNotes(notes, trimmed, projects)
      break
    case 'resources':
      results = searchResources(resources, trimmed, projects)
      break
    case 'all':
    default: {
      const p = searchProjects(projects, trimmed)
      const t = searchTasks(tasks, trimmed, projects)
      const s = searchSessions(sessions, trimmed, projects)
      const n = searchNotes(notes, trimmed, projects)
      const r = searchResources(resources, trimmed, projects)
      results = [...p, ...t, ...s, ...n, ...r]
      break
    }
  }

  results.sort(compareSearchResults)

  if (maxResults && maxResults > 0) {
    return results.slice(0, maxResults)
  }

  return results
}
