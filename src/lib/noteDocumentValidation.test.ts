import { describe, expect, it } from 'vitest'
import { isValidNoteDocument } from './noteDocumentValidation'

describe('isValidNoteDocument resource bounds', () => {
  it('rejects a document whose first level alone exceeds the node budget', () => {
    const document = {
      type: 'doc',
      content: new Array(50_001).fill({ type: 'text', text: 'x' }),
    }

    expect(isValidNoteDocument(document)).toBe(false)
  })

  it('rejects excessive nested fan-out before queuing every descendant', () => {
    const document = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: new Array(50_000).fill({ type: 'text', text: 'x' }),
      }],
    }

    expect(isValidNoteDocument(document)).toBe(false)
  })

  it('accepts ordinary editor documents', () => {
    expect(isValidNoteDocument({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }],
      }],
    })).toBe(true)
  })
})
