import { describe, expect, it } from 'vitest'
import { isNetworkChunkFailure } from './AppErrorBoundary'

describe('failed route chunk detection', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://app.test/assets/Calendar-a1b2.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/KnowledgeHub-a1b2.css',
    'Loading chunk 42 failed.',
  ])('recognizes a network or stale-asset failure: %s', message => {
    expect(isNetworkChunkFailure(new TypeError(message))).toBe(true)
  })

  it.each([
    'Unexpected token in module source',
    'Cannot read properties of undefined (reading "id")',
    'Maximum update depth exceeded',
  ])('does not classify an application error as an update: %s', message => {
    expect(isNetworkChunkFailure(new Error(message))).toBe(false)
  })
})
