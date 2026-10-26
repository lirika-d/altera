/**
 * src/components/search/index.ts
 *
 * Public exports for ALTERA Search and Command Palette.
 */

export { CommandPalette } from './CommandPalette'
export type { CommandPaletteProps, CommandCallbacks } from './CommandPalette'

export {
  scoreField,
  SCORE_WEIGHTS,
  extractSnippet,
  highlightMatches,
  searchProjects,
  searchTasks,
  searchSessions,
  searchNotes,
  searchResources,
  compareSearchResults,
  getSearchCounts,
  searchEntities,
} from './searchUtils'

export type {
  SearchEntityType,
  SearchFilterType,
  SearchResultItem,
  SearchResultMetadata,
  SearchCounts,
  SearchData,
  SearchEntitiesOptions,
  TextSegment,
} from './searchUtils'

export { useSearch, useSearchData } from './useSearch'
export type { UseSearchOptions, UseSearchResult } from './useSearch'
