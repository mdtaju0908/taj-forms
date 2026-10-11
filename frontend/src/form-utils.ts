import type { Answer } from './types'
import type { FormField } from './types'
import { z } from 'zod'

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function fieldError(field: FormField, value: Answer | undefined) {
  const filled = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).trim().length > 0
  if (field.required && !filled) return 'This question is required.'
  if (!filled) return ''
  if (field.type === 'checkbox') {
    if (!Array.isArray(value) || value.length > field.options.length || value.some((item) => !field.options.some((option) => option.id === item))) return 'Choose valid listed options.'
    return ''
  }
  if (Array.isArray(value)) return 'Enter a valid answer.'
  const text = String(value).trim()
  if (text.length > (field.type === 'long_text' ? 10000 : 2000)) return 'Your answer is too long.'
  if (field.type === 'email' && !z.string().email().safeParse(text).success) return 'Enter a valid email address.'
  if (['dropdown', 'radio'].includes(field.type) && !field.options.some((option) => option.id === text)) return 'Choose one of the listed options.'
  if (field.type === 'number' && (text.length > 80 || !Number.isFinite(Number(text)))) return 'Enter a valid number.'
  if (field.type === 'date' && !isCalendarDate(text)) return 'Enter a valid date.'
  if (field.type === 'rating' && (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 5)) return 'Choose a rating from 1 to 5.'
  return ''
}

export function createFormAnswerSchema(fields: FormField[]) {
  const shape = Object.fromEntries([
    ...fields.map((field) => [field.id, z.unknown().superRefine((value: unknown, context: { addIssue: (issue: { code: 'custom'; message: string }) => void }) => {
      const error = fieldError(field, value as Answer | undefined)
      if (error) context.addIssue({ code: 'custom', message: error })
    })] as const),
    ['website', z.string().optional()],
  ])
  return z.object(shape).strict()
}

export function validateFormAnswers(fields: FormField[], answers: Record<string, Answer>) {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const error = fieldError(field, answers[field.id])
    if (error) errors[field.id] = error
  }
  return errors
}

export function formatAnswer(field: FormField, value: Answer | undefined) {
  if (value === undefined || value === '') return '—'
  const values = Array.isArray(value) ? value : [String(value)]
  if (['dropdown', 'radio', 'checkbox'].includes(field.type)) return values.map((id) => field.options.find((option) => option.id === id)?.label || id).join(', ')
  return values.join(', ')
}
