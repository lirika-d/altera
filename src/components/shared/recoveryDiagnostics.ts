export type RecoveryFailureCode = 'DATABASE_INITIALIZATION_FAILED' | 'RENDER_FAILED'

/** Keep exported diagnostics structured and free of user records or raw errors. */
export function serializeRecoveryDiagnostics(
  code: RecoveryFailureCode,
  generatedAt = new Date()
): string {
  return JSON.stringify({
    app: 'ALTERA',
    code,
    generatedAt: generatedAt.toISOString(),
  }, null, 2)
}
