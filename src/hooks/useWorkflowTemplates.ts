import { useLiveQuery } from 'dexie-react-hooks'
import { getWorkflowTemplates } from '@/db/templates'
import type { WorkflowTemplate } from '@/types'

const EMPTY_TEMPLATES: WorkflowTemplate[] = []

export function useWorkflowTemplates(kind?: WorkflowTemplate['kind'], enabled = true): WorkflowTemplate[] {
  return useLiveQuery(
    () => enabled ? getWorkflowTemplates(kind) : Promise.resolve(EMPTY_TEMPLATES),
    [kind, enabled]
  ) ?? EMPTY_TEMPLATES
}
