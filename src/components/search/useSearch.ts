/**
 * useSearch.ts — Reactive hook for multi-entity search in ALTERA
 *
 * Automatically queries IndexedDB (Dexie) reactively via dexie-react-hooks,
 * recalculating scores, counts, and ranked results in realtime whenever any
 * entity is modified.
 */

import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import {
  searchEntities,
  getSearchCounts,
  type SearchFilterType,
  type SearchResultItem,
  type SearchCounts,
  type SearchData,
} from './searchUtils'
import type { Note, Resource } from '@/types'

const EMPTY_SEARCH_DATA: SearchData = { projects: [], tasks: [], sessions: [], notes: [], resources: [] }

export interface UseSearchOptions {
  enabled?: boolean
  maxResults?: number
  allowEmptyQuery?: boolean
}

export interface UseSearchResult {
  results: SearchResultItem[]
  counts: SearchCounts
  isReady: boolean
  data: SearchData
}

/**
 * Reactively queries all active entity tables from IndexedDB.
 */
export function useSearchData(enabled = true): SearchData & { isReady: boolean } {
  const queryResult = useLiveQuery(
    async () => {
      if (!enabled) return undefined
      const [projects, tasks, sessions, notes, resources] = await Promise.all([
        db.projects.toArray(),
        db.tasks.toArray(),
        db.sessions.toArray(),
        db.notes.filter((n: Note) => !n.deletedAt).toArray(),
        db.resources.filter((r: Resource) => !r.deletedAt).toArray(),
      ])
      return {
        projects,
        tasks,
        sessions,
        notes,
        resources,
      }
    },
    [enabled]
  )

  return React.useMemo(() => ({
    ...(enabled && queryResult ? queryResult : EMPTY_SEARCH_DATA),
    isReady: enabled && queryResult !== undefined,
  }), [enabled, queryResult])
}

/**
 * Reactive hook that runs multi-entity search and provides item counts per filter.
 */
export function useSearch(
  query: string,
  filter: SearchFilterType = 'all',
  options?: UseSearchOptions
): UseSearchResult {
  const data = useSearchData(options?.enabled ?? true)
  const { maxResults = 50, allowEmptyQuery = false } = options || {}

  const counts = React.useMemo(() => {
    return getSearchCounts(data, query)
  }, [data, query])

  const results = React.useMemo(() => {
    return searchEntities({
      query,
      filter,
      data,
      maxResults,
      allowEmptyQuery,
    })
  }, [data, query, filter, maxResults, allowEmptyQuery])

  return {
    results,
    counts,
    isReady: data.isReady,
    data,
  }
}
