import { describe, expect, it } from 'vitest'
import { formatAnswer, validateFormAnswers } from './form-utils'
import type { FormField } from './types'

const fields: FormField[] = [
  { id: 'email', type: 'email', label: 'Email', description: '', placeholder: '', required: true, options: [] },
  { id: 'choice', type: 'dropdown', label: 'Choice', description: '', placeholder: '', required: false, options: [{ id: 'first', label: 'First option' }] },
  { id: 'tags', type: 'checkbox', label: 'Tags', description: '', placeholder: '', required: false, options: [{ id: 'ai', label: 'AI' }] },
  { id: 'count', type: 'number', label: 'Count', description: '', placeholder: '', required: false, options: [] },
  { id: 'date', type: 'date', label: 'Date', description: '', placeholder: '', required: false, options: [] },
  { id: 'rating', type: 'rating', label: 'Rating', description: '', placeholder: '', required: false, options: [] },
  { id: 'message', type: 'long_text', label: 'Message', description: '', placeholder: '', required: false, options: [] },
]

describe('form answer helpers', () => {
  it('checks required fields, email format, and known choice IDs', () => {
    expect(validateFormAnswers(fields, {})).toEqual({ email: 'This question is required.' })
    expect(validateFormAnswers(fields, { email: 'bad', choice: 'other' })).toEqual({ email: 'Enter a valid email address.', choice: 'Choose one of the listed options.' })
    expect(validateFormAnswers(fields, { email: 'valid@example.com', choice: 'first' })).toEqual({})
  })

  it('renders saved option IDs as human-readable option labels', () => {
    expect(formatAnswer(fields[1], 'first')).toBe('First option')
    expect(formatAnswer(fields[2], ['ai'])).toBe('AI')
  })

  it('validates numeric zero, real calendar dates, rating range, and answer length', () => {
    expect(validateFormAnswers(fields, { email: 'valid@example.com', count: '0', date: '2024-02-29', rating: '5' })).toEqual({})
    expect(validateFormAnswers(fields, { email: 'valid@example.com', count: 'Infinity', date: '2025-02-29', rating: '6', message: 'x'.repeat(10001) })).toEqual({
      count: 'Enter a valid number.',
      date: 'Enter a valid date.',
      rating: 'Choose a rating from 1 to 5.',
      message: 'Your answer is too long.',
    })
  })

  it('rejects malformed checkbox answers', () => {
    expect(validateFormAnswers(fields, { email: 'valid@example.com', tags: ['missing'] })).toEqual({ tags: 'Choose valid listed options.' })
    expect(validateFormAnswers(fields, { email: 'valid@example.com', tags: 'ai' as never })).toEqual({ tags: 'Choose valid listed options.' })
  })
})
