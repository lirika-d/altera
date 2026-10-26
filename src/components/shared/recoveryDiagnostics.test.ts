import { describe, expect, it } from 'vitest'
import { serializeRecoveryDiagnostics } from './recoveryDiagnostics'

describe('recovery diagnostics', () => {
  it('exports a stable safe report without database or user content', () => {
    const report = JSON.parse(serializeRecoveryDiagnostics(
      'DATABASE_INITIALIZATION_FAILED',
      new Date('2026-10-26T00:00:00.000Z')
    ))

    expect(report).toEqual({
      app: 'ALTERA',
      code: 'DATABASE_INITIALIZATION_FAILED',
      generatedAt: '2026-10-26T00:00:00.000Z',
    })
    expect(report).not.toHaveProperty('data')
    expect(report).not.toHaveProperty('error')
  })
})
