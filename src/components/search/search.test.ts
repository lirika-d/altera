import { describe, it, expect } from 'vitest'
import {
  scoreField,
  SCORE_WEIGHTS,
  extractSnippet,
  highlightMatches,
  searchProjects,
  searchTasks,
  searchSessions,
  searchNotes,
  searchResources,
  searchEntities,
  getSearchCounts,
  compareSearchResults,
  type SearchData,
} from './searchUtils'
import type { Project, Task, Session, Note, Resource } from '@/types'

// Mock fixtures
const mockProjects: Project[] = [
  {
    id: 'proj-1',
    identifier: 'ALT-001',
    name: 'Knowledge Hub',
    description: 'Centralized wiki and notes repository for engineering',
    status: 'active',
    priority: 'high',
    color: '#3b82f6',
    icon: '📚',
    progress: 75,
    nextAction: 'Integrate full text search palette',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-15'),
  },
  {
    id: 'proj-2',
    identifier: 'ALT-002',
    name: 'Search Engine Core',
    description: 'Deterministic local client search pipeline',
    status: 'active',
    priority: 'urgent',
    color: '#10b981',
    icon: '⚡',
    progress: 90,
    nextAction: 'Add vitest test suite',
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-20'),
  },
  {
    id: 'proj-3',
    identifier: 'ALT-003',
    name: 'Mobile Companion',
    description: 'React Native companion app',
    status: 'paused',
    priority: 'medium',
    color: '#8b5cf6',
    icon: '📱',
    progress: 20,
    nextAction: 'Review push notifications',
    createdAt: new Date('2026-01-03'),
    updatedAt: new Date('2026-01-10'),
  },
]

const mockTasks: Task[] = [
  {
    id: 'task-1',
    projectId: 'proj-1',
    title: 'Design Command Palette UI',
    status: 'in_progress',
    priority: 'high',
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-01-16'),
    order: 1,
  },
  {
    id: 'task-2',
    projectId: 'proj-1',
    title: 'Search keyboard shortcut listener',
    status: 'todo',
    priority: 'urgent',
    createdAt: new Date('2026-01-06'),
    updatedAt: new Date('2026-01-17'),
    order: 2,
  },
  {
    id: 'task-3',
    projectId: 'proj-2',
    title: 'Benchmark indexing throughput',
    status: 'done',
    priority: 'medium',
    createdAt: new Date('2026-01-07'),
    updatedAt: new Date('2026-01-18'),
    order: 1,
  },
]

const mockSessions: Session[] = [
  {
    id: 'sess-1',
    projectId: 'proj-1',
    taskId: 'task-1',
    title: 'Command Palette prototyping',
    objective: 'Create mockups and keyboard navigation specs',
    status: 'completed',
    startedAt: new Date('2026-01-10T10:00:00Z'),
    endedAt: new Date('2026-01-10T11:30:00Z'),
    lastResumedAt: new Date('2026-01-10T10:00:00Z'),
    accumulatedDurationMs: 5400000,
    accomplishments: 'Built keyboard arrow nav and filter pills for search',
    blockers: 'None',
    nextStep: 'Connect to Dexie database',
    outcome: 'Successful spike test',
    createdAt: new Date('2026-01-10T10:00:00Z'),
    updatedAt: new Date('2026-01-10T11:30:00Z'),
  },
  {
    id: 'sess-2',
    projectId: 'proj-2',
    title: 'Search index scoring',
    objective: 'Implement deterministic relevance ranker',
    status: 'running',
    startedAt: new Date('2026-01-12T14:00:00Z'),
    lastResumedAt: new Date('2026-01-12T14:00:00Z'),
    accumulatedDurationMs: 1800000,
    accomplishments: 'Implemented exact vs prefix vs substring title logic',
    blockers: 'Memory profiling',
    nextStep: 'Finalize snippet extraction',
    outcome: '',
    createdAt: new Date('2026-01-12T14:00:00Z'),
    updatedAt: new Date('2026-01-12T14:30:00Z'),
  },
]

const mockNotes: Note[] = [
  {
    id: 'note-1',
    projectId: 'proj-1',
    title: 'Search Architecture RFC',
    contentJSON: '{}',
    plainText:
      'We need a deterministic client-side search engine. It should match projects, tasks, sessions, notes, and resources with instant feedback.',
    isFavorite: true,
    revision: 1,
    createdAt: new Date('2026-01-08'),
    updatedAt: new Date('2026-01-19'),
  },
  {
    id: 'note-2',
    title: 'Search Keyboard Shortcuts',
    contentJSON: '{}',
    plainText: 'Global shortcuts: Ctrl+K or Cmd+K to open, Escape to close, / to focus search.',
    isFavorite: false,
    revision: 1,
    createdAt: new Date('2026-01-09'),
    updatedAt: new Date('2026-01-18'),
  },
  {
    id: 'note-deleted',
    title: 'Old Deprecated Notes',
    contentJSON: '{}',
    plainText: 'This is in trash and should never appear in active search.',
    isFavorite: false,
    revision: 1,
    deletedAt: new Date('2026-01-10'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-10'),
  },
]

const mockResources: Resource[] = [
  {
    id: 'res-1',
    projectId: 'proj-1',
    type: 'link',
    title: 'Search UX Design System Reference',
    description: 'Linear style command bar guidelines and accessibility specs',
    url: 'https://linear.app/docs/command-palette',
    isFavorite: true,
    createdAt: new Date('2026-01-04'),
    updatedAt: new Date('2026-01-14'),
  },
  {
    id: 'res-2',
    projectId: 'proj-2',
    type: 'snippet',
    title: 'Search Highlight Regex Helper',
    description: 'Utility code for match slicing',
    snippetContent: 'function highlight(text, query) { return text.split(query) }',
    language: 'typescript',
    isFavorite: false,
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-01-15'),
  },
  {
    id: 'res-deleted',
    type: 'link',
    title: 'Deleted Resource',
    url: 'https://example.com/deleted',
    deletedAt: new Date('2026-01-11'),
    isFavorite: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-11'),
  },
]

const mockSearchData: SearchData = {
  projects: mockProjects,
  tasks: mockTasks,
  sessions: mockSessions,
  notes: mockNotes,
  resources: mockResources,
}

describe('searchUtils', () => {
  describe('Relevance Scoring Hierarchy', () => {
    it('enforces exact title match > prefix match > substring match in title > substring match in content', () => {
      const exactTitleScore = scoreField('Search', 'Search', 'title')
      const prefixTitleScore = scoreField('Search Engine', 'Search', 'title')
      const wordPrefixTitleScore = scoreField('Altera Search Engine', 'Search', 'title')
      const substringTitleScore = scoreField('Researching Technology', 'Search', 'title')
      const contentPrefixScore = scoreField('Search index architecture notes', 'Search', 'content')
      const contentSubstringScore = scoreField(
        'Thorough researching into technology',
        'Search',
        'content'
      )

      expect(exactTitleScore).toBe(SCORE_WEIGHTS.EXACT_TITLE)
      expect(prefixTitleScore).toBe(SCORE_WEIGHTS.PREFIX_TITLE)
      expect(wordPrefixTitleScore).toBe(SCORE_WEIGHTS.WORD_PREFIX_TITLE)
      expect(substringTitleScore).toBe(SCORE_WEIGHTS.SUBSTRING_TITLE)
      expect(contentPrefixScore).toBe(SCORE_WEIGHTS.WORD_PREFIX_CONTENT)
      expect(contentSubstringScore).toBe(SCORE_WEIGHTS.SUBSTRING_CONTENT)

      // Strict ranking verification
      expect(exactTitleScore).toBeGreaterThan(prefixTitleScore)
      expect(prefixTitleScore).toBeGreaterThan(wordPrefixTitleScore)
      expect(wordPrefixTitleScore).toBeGreaterThan(substringTitleScore)
      expect(substringTitleScore).toBeGreaterThan(contentPrefixScore)
      expect(contentPrefixScore).toBeGreaterThan(contentSubstringScore)
    })

    it('enforces exact identifier match > prefix identifier match > substring identifier match', () => {
      const exactId = scoreField('ALT-001', 'ALT-001', 'identifier')
      const prefixId = scoreField('ALT-001', 'ALT', 'identifier')
      const substrId = scoreField('ALT-001', '001', 'identifier')

      expect(exactId).toBe(SCORE_WEIGHTS.EXACT_IDENTIFIER)
      expect(prefixId).toBe(SCORE_WEIGHTS.PREFIX_IDENTIFIER)
      expect(substrId).toBe(SCORE_WEIGHTS.SUBSTRING_IDENTIFIER)

      expect(exactId).toBeGreaterThan(prefixId)
      expect(prefixId).toBeGreaterThan(substrId)
    })

    it('handles case-insensitivity and whitespace trimming cleanly', () => {
      const scoreUpper = scoreField('KNOWLEDGE HUB', 'knowledge hub', 'title')
      const scoreTrimmed = scoreField('  Knowledge Hub  ', '  knowledge hub  ', 'title')

      expect(scoreUpper).toBe(SCORE_WEIGHTS.EXACT_TITLE)
      expect(scoreTrimmed).toBe(SCORE_WEIGHTS.EXACT_TITLE)
    })

    it('returns 0 for non-matching queries', () => {
      expect(scoreField('Knowledge Hub', 'quantum', 'title')).toBe(0)
      expect(scoreField('ALT-001', 'XYZ', 'identifier')).toBe(0)
      expect(scoreField('Some notes description', 'zebra', 'content')).toBe(0)
    })
  })

  describe('Snippet Extraction', () => {
    it('returns empty string when given null or empty text', () => {
      expect(extractSnippet(null, 'test')).toBe('')
      expect(extractSnippet(undefined, 'test')).toBe('')
      expect(extractSnippet('', 'test')).toBe('')
    })

    it('returns text as-is when shorter than maxLength', () => {
      const shortText = 'Clean code and documentation.'
      expect(extractSnippet(shortText, 'code', 300)).toBe(shortText)
    })

    it('truncates cleanly with ellipsis when query is empty', () => {
      const longText = 'A'.repeat(400)
      const snippet = extractSnippet(longText, '', 100)
      expect(snippet.endsWith('…')).toBe(true)
      expect(snippet.length).toBe(101) // 100 chars + ellipsis
    })

    it('centers snippet window around match with ellipsis when text is long', () => {
      const prefix = 'Introductory words '.repeat(10) // ~190 chars
      const target = 'CRITICAL_KEYWORD'
      const suffix = ' concluding notes here.'.repeat(10) // ~230 chars
      const fullText = `${prefix} ${target} ${suffix}`

      const snippet = extractSnippet(fullText, 'CRITICAL_KEYWORD', 100)
      expect(snippet).toContain('CRITICAL_KEYWORD')
      expect(snippet.startsWith('…')).toBe(true)
      expect(snippet.endsWith('…')).toBe(true)
    })

    it('does not prepend ellipsis when match is near start of text', () => {
      const text = `StartKeyword is right at the beginning followed by ${'lots of words '.repeat(30)}`
      const snippet = extractSnippet(text, 'StartKeyword', 100)
      expect(snippet.startsWith('StartKeyword')).toBe(true)
      expect(snippet.endsWith('…')).toBe(true)
    })

    it('does not append ellipsis when match is near end of text', () => {
      const text = `${'Introductory text '.repeat(30)} followed by EndKeyword`
      const snippet = extractSnippet(text, 'EndKeyword', 100)
      expect(snippet.endsWith('EndKeyword')).toBe(true)
      expect(snippet.startsWith('…')).toBe(true)
    })
  })

  describe('Match Highlighting', () => {
    it('returns original text segment when query is empty or not found', () => {
      expect(highlightMatches('Hello World', '')).toEqual([
        { text: 'Hello World', isMatch: false },
      ])
      expect(highlightMatches('Hello World', 'xyz')).toEqual([
        { text: 'Hello World', isMatch: false },
      ])
    })

    it('splits text into matching and non-matching segments preserving case', () => {
      const segments = highlightMatches('Deterministic Search Engine for search users', 'search')
      expect(segments).toEqual([
        { text: 'Deterministic ', isMatch: false },
        { text: 'Search', isMatch: true },
        { text: ' Engine for ', isMatch: false },
        { text: 'search', isMatch: true },
        { text: ' users', isMatch: false },
      ])
    })

    it('handles special characters safely without regex crashing', () => {
      const segments = highlightMatches('Path [C:\\test\\file.ts] (v1.0)', '[C:\\test')
      expect(segments.length).toBe(3)
      expect(segments[0]).toEqual({ text: 'Path ', isMatch: false })
      expect(segments[1]).toEqual({ text: '[C:\\test', isMatch: true })
      expect(segments[2]).toEqual({ text: '\\file.ts] (v1.0)', isMatch: false })
    })
  })

  describe('Multi-Entity Querying', () => {
    it('searches across all 5 entity types simultaneously', () => {
      const results = searchEntities({
        query: 'search',
        data: mockSearchData,
      })

      const foundTypes = new Set(results.map((r) => r.type))
      expect(foundTypes.has('project')).toBe(true) // Search Engine Core
      expect(foundTypes.has('task')).toBe(true) // Search keyboard shortcut listener
      expect(foundTypes.has('session')).toBe(true) // Search index scoring
      expect(foundTypes.has('note')).toBe(true) // Search Architecture RFC
      expect(foundTypes.has('resource')).toBe(true) // Search UX Design System Reference
    })

    it('matches project fields (name, identifier, description, nextAction)', () => {
      // Name match
      const byName = searchProjects(mockProjects, 'Mobile Companion')
      expect(byName.length).toBe(1)
      expect(byName[0].id).toBe('proj-3')

      // Identifier match
      const byId = searchProjects(mockProjects, 'ALT-001')
      expect(byId.length).toBe(1)
      expect(byId[0].id).toBe('proj-1')

      // Description match
      const byDesc = searchProjects(mockProjects, 'wiki and notes repository')
      expect(byDesc.length).toBe(1)
      expect(byDesc[0].id).toBe('proj-1')

      // Next Action match
      const byNextAction = searchProjects(mockProjects, 'vitest test suite')
      expect(byNextAction.length).toBe(1)
      expect(byNextAction[0].id).toBe('proj-2')
    })

    it('matches task fields (title, priority, status, project name)', () => {
      // Title match
      const byTitle = searchTasks(mockTasks, 'Benchmark indexing', mockProjects)
      expect(byTitle.length).toBe(1)
      expect(byTitle[0].id).toBe('task-3')

      // Project name match
      const byProj = searchTasks(mockTasks, 'Knowledge Hub', mockProjects)
      expect(byProj.length).toBe(2) // task-1 and task-2 belong to Knowledge Hub
    })

    it('matches session fields (title, objective, accomplishments, nextStep)', () => {
      // Title match
      const byTitle = searchSessions(mockSessions, 'prototyping', mockProjects)
      expect(byTitle.length).toBe(1)
      expect(byTitle[0].id).toBe('sess-1')

      // Accomplishments match
      const byAccomp = searchSessions(mockSessions, 'arrow nav', mockProjects)
      expect(byAccomp.length).toBe(1)
      expect(byAccomp[0].id).toBe('sess-1')

      // Objective match
      const byObj = searchSessions(mockSessions, 'relevance ranker', mockProjects)
      expect(byObj.length).toBe(1)
      expect(byObj[0].id).toBe('sess-2')
    })

    it('matches note fields (title, plainText preview) and excludes soft-deleted notes', () => {
      // Title match
      const byTitle = searchNotes(mockNotes, 'Architecture RFC', mockProjects)
      expect(byTitle.length).toBe(1)
      expect(byTitle[0].id).toBe('note-1')

      // Content match
      const byContent = searchNotes(mockNotes, 'instant feedback', mockProjects)
      expect(byContent.length).toBe(1)
      expect(byContent[0].id).toBe('note-1')

      // Excludes deleted note
      const byDeleted = searchNotes(mockNotes, 'Deprecated', mockProjects)
      expect(byDeleted.length).toBe(0)
    })

    it('matches resource fields (title, description, url, snippetContent) and excludes deleted', () => {
      // URL match
      const byUrl = searchResources(mockResources, 'linear.app', mockProjects)
      expect(byUrl.length).toBe(1)
      expect(byUrl[0].id).toBe('res-1')

      // Snippet content match
      const bySnippet = searchResources(mockResources, 'split(query)', mockProjects)
      expect(bySnippet.length).toBe(1)
      expect(bySnippet[0].id).toBe('res-2')

      // Excludes deleted resource
      const byDeleted = searchResources(mockResources, 'Deleted Resource', mockProjects)
      expect(byDeleted.length).toBe(0)
    })
  })

  describe('Type Filtering & Counts', () => {
    it('filters correctly when entity type filter is applied', () => {
      const allResults = searchEntities({
        query: 'search',
        filter: 'all',
        data: mockSearchData,
      })
      const projectOnly = searchEntities({
        query: 'search',
        filter: 'projects',
        data: mockSearchData,
      })
      const taskOnly = searchEntities({
        query: 'search',
        filter: 'tasks',
        data: mockSearchData,
      })
      const sessionOnly = searchEntities({
        query: 'search',
        filter: 'sessions',
        data: mockSearchData,
      })
      const noteOnly = searchEntities({
        query: 'search',
        filter: 'notes',
        data: mockSearchData,
      })
      const resourceOnly = searchEntities({
        query: 'search',
        filter: 'resources',
        data: mockSearchData,
      })

      expect(allResults.length).toBeGreaterThan(projectOnly.length)
      expect(projectOnly.every((r) => r.type === 'project')).toBe(true)
      expect(taskOnly.every((r) => r.type === 'task')).toBe(true)
      expect(sessionOnly.every((r) => r.type === 'session')).toBe(true)
      expect(noteOnly.every((r) => r.type === 'note')).toBe(true)
      expect(resourceOnly.every((r) => r.type === 'resource')).toBe(true)
    })

    it('computes accurate match counts per category for non-empty queries', () => {
      const counts = getSearchCounts(mockSearchData, 'search')
      expect(counts.projects).toBe(2) // Search Engine Core (name) + Knowledge Hub (nextAction)
      expect(counts.tasks).toBe(2) // Search keyboard listener (title) + Benchmark (proj: Search Engine Core)
      expect(counts.sessions).toBe(2) // sess-2 (title: Search index) + sess-1 (accomplishments: search)
      expect(counts.notes).toBe(2) // note-1 (content mentions search) & note-2 (title contains Search)
      expect(counts.resources).toBe(2) // res-1 (title Search UX) & res-2 (title Search Highlight)
      expect(counts.all).toBe(10)
    })

    it('computes total active counts when query is empty', () => {
      const counts = getSearchCounts(mockSearchData, '')
      expect(counts.projects).toBe(3)
      expect(counts.tasks).toBe(3)
      expect(counts.sessions).toBe(2)
      expect(counts.notes).toBe(2) // 3 total minus 1 soft-deleted
      expect(counts.resources).toBe(2) // 3 total minus 1 soft-deleted
      expect(counts.all).toBe(12)
    })
  })

  describe('Deterministic Tie-Breaking & Ranking', () => {
    it('ranks exact title match higher than prefix and substring in searchEntities', () => {
      const customNotes: Note[] = [
        {
          id: 'n-content',
          title: 'Daily Standup Notes',
          contentJSON: '',
          plainText: 'We discussed auth security today.',
          isFavorite: false,
          revision: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
        {
          id: 'n-substring',
          title: 'OAuth Integration',
          contentJSON: '',
          plainText: 'OAuth protocol docs',
          isFavorite: false,
          revision: 1,
          createdAt: new Date('2026-01-02'),
          updatedAt: new Date('2026-01-02'),
        },
        {
          id: 'n-prefix',
          title: 'Auth Guidelines',
          contentJSON: '',
          plainText: 'Authentication guidelines',
          isFavorite: false,
          revision: 1,
          createdAt: new Date('2026-01-03'),
          updatedAt: new Date('2026-01-03'),
        },
        {
          id: 'n-exact',
          title: 'Auth',
          contentJSON: '',
          plainText: 'Core auth module',
          isFavorite: false,
          revision: 1,
          createdAt: new Date('2026-01-04'),
          updatedAt: new Date('2026-01-04'),
        },
      ]

      const results = searchEntities({
        query: 'Auth',
        filter: 'notes',
        data: { notes: customNotes },
      })

      expect(results.length).toBe(4)
      expect(results[0].id).toBe('n-exact') // Exact title match (1000)
      expect(results[1].id).toBe('n-prefix') // Prefix match (800)
      expect(results[2].id).toBe('n-substring') // Substring in title (500)
      expect(results[3].id).toBe('n-content') // Substring in content only (100)
    })

    it('breaks ties deterministically using shorter title, then recency', () => {
      const itemA = {
        id: '1',
        type: 'note' as const,
        title: 'Alpha',
        score: 500,
        metadata: { date: new Date('2026-01-01') },
        rawItem: mockNotes[0],
      }
      const itemB = {
        id: '2',
        type: 'note' as const,
        title: 'Alpha Long Version',
        score: 500,
        metadata: { date: new Date('2026-01-01') },
        rawItem: mockNotes[0],
      }

      // Shorter title should win tie
      expect(compareSearchResults(itemA, itemB)).toBeLessThan(0)
    })

    it('respects maxResults limit', () => {
      const results = searchEntities({
        query: 'search',
        data: mockSearchData,
        maxResults: 3,
      })
      expect(results.length).toBe(3)
    })

    it('handles multi-word queries gracefully', () => {
      const results = searchEntities({
        query: 'Search Engine',
        data: mockSearchData,
      })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].title).toBe('Search Engine Core')
    })

    it('returns empty array when query is empty and allowEmptyQuery is false', () => {
      const results = searchEntities({
        query: '',
        data: mockSearchData,
        allowEmptyQuery: false,
      })
      expect(results).toEqual([])
    })

    it('returns all items when allowEmptyQuery is true', () => {
      const results = searchEntities({
        query: '',
        data: mockSearchData,
        allowEmptyQuery: true,
      })
      // 3 projects + 3 tasks + 2 sessions + 2 notes + 2 resources = 12 items
      expect(results.length).toBe(12)
    })
  })

  describe('Database Integration', () => {
    it('integrates seamlessly with IndexedDB data', async () => {
      const testProject: Project = {
        id: 'db-p1',
        identifier: 'ALT-999',
        name: 'IndexedDB Integration Test',
        description: 'Testing live Dexie queries with search indexer',
        status: 'active',
        priority: 'high',
        color: '#3b82f6',
        icon: '⚡',
        progress: 50,
        nextAction: 'Verify search returns this project',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const results = searchEntities({
        query: 'ALT-999',
        data: { projects: [testProject] },
      })

      expect(results.length).toBe(1)
      expect(results[0].title).toBe('IndexedDB Integration Test')
      expect(results[0].identifier).toBe('ALT-999')
      expect(results[0].score).toBe(SCORE_WEIGHTS.EXACT_IDENTIFIER)
    })
  })
})
