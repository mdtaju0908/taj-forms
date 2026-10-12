import { z } from 'zod'
import type { FormField, FieldType } from './types.js'

export const fieldTypes = ['short_text', 'long_text', 'email', 'number', 'dropdown', 'radio', 'checkbox', 'date', 'rating'] as const satisfies readonly FieldType[]
const optionSchema = z.object({ id: z.string().min(1).max(60), label: z.string().trim().min(1).max(100) }).strict()
export const formFieldSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
  type: z.enum(fieldTypes),
  label: z.string().trim().min(1).max(120),
  description: z.string().max(300).default(''),
  placeholder: z.string().max(160).default(''),
  required: z.boolean().default(false),
  options: z.array(optionSchema).max(30).default([]),
}).strict().superRefine((field, ctx) => {
  if (field.id === 'website') ctx.addIssue({ code: 'custom', path: ['id'], message: 'This question ID is reserved.' })
  const choices = ['dropdown', 'radio', 'checkbox'].includes(field.type)
  if (choices && field.options.length < 1) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least one option to this question.' })
  if (!choices && field.options.length > 0) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Only choice questions can have options.' })
  if (new Set(field.options.map((option) => option.id)).size !== field.options.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Option IDs must be unique.' })
})

export const formDefinitionSchema = z.object({
  version: z.literal(1).default(1),
  fields: z.array(formFieldSchema).max(50),
}).strict().superRefine((definition, ctx) => {
  if (new Set(definition.fields.map((field) => field.id)).size !== definition.fields.length) ctx.addIssue({ code: 'custom', path: ['fields'], message: 'Question IDs must be unique.' })
})

// Mongoose document-array items expose schema fields through getters and also
// carry enumerable/internal document state. Pick only the public field shape
// before passing persisted questions to strict Zod schemas or JSON responses.
const recordOf = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}

export const toPlainFormFields = (fields: readonly unknown[]): FormField[] => fields.map((item) => {
  const field = recordOf(item)
  const options = Array.isArray(field.options)
    ? field.options.map((entry) => {
      const option = recordOf(entry)
      return { id: option.id as string, label: option.label as string }
    })
    : []

  return {
    id: field.id as string,
    type: field.type as FieldType,
    label: field.label as string,
    description: (field.description ?? '') as string,
    placeholder: (field.placeholder ?? '') as string,
    required: (field.required ?? false) as boolean,
    options,
  }
})

export const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(254), password: z.string().min(10).max(128) }).strict()
export const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict()
export const formCreateSchema = z.object({ title: z.string().trim().min(1).max(120).default('Untitled form') }).strict()
export const formPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(600).optional(),
  coverImage: z.union([z.literal(''), z.string().max(850000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Upload a PNG, JPEG, or WebP cover image under 600 KB.')]).optional(),
  fields: z.array(formFieldSchema).max(50).optional(),
  definitionVersion: z.literal(1).optional(),
  theme: z.object({ accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), background: z.string().regex(/^#[0-9a-fA-F]{6}$/), layout: z.enum(['classic', 'compact']) }).strict().optional(),
  confirmationMessage: z.string().trim().min(1).max(500).optional(),
  status: z.enum(['draft', 'archived']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required')
export const reportSchema = z.object({ reason: z.enum(['spam', 'phishing', 'harassment', 'other']), details: z.string().trim().max(1200).default(''), email: z.string().trim().email().max(254).optional(), website: z.string().max(200).optional() }).strict()

const isBlank = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)
const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export const validateSubmissionAnswers = (fields: FormField[], input: unknown) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false as const, message: 'Answers must be an object.' }
  const answers = input as Record<string, unknown>
  const fieldIds = new Set(fields.map((field) => field.id))
  if (Object.keys(answers).some((key) => !fieldIds.has(key))) return { ok: false as const, message: 'The response contains an unknown question.' }
  const normalized: Record<string, string | number | string[]> = {}

  for (const field of fields) {
    const value = answers[field.id]
    if (isBlank(value)) {
      if (field.required) return { ok: false as const, message: `${field.label} is required.` }
      continue
    }
    if (field.type === 'checkbox') {
      if (!Array.isArray(value) || value.length > field.options.length || value.some((entry) => typeof entry !== 'string' || !field.options.some((option) => option.id === entry))) return { ok: false as const, message: `Select valid choices for ${field.label}.` }
      normalized[field.id] = [...new Set(value as string[])]
      continue
    }
    if (typeof value !== 'string' && typeof value !== 'number') return { ok: false as const, message: `Enter a valid answer for ${field.label}.` }
    const text = String(value).trim()
    if (text.length > (field.type === 'long_text' ? 10000 : 2000)) return { ok: false as const, message: `${field.label} is too long.` }
    if (field.type === 'email' && !z.string().email().safeParse(text).success) return { ok: false as const, message: `Enter a valid email for ${field.label}.` }
    if (field.type === 'number' && (text.length > 80 || !Number.isFinite(Number(text)))) return { ok: false as const, message: `Enter a valid number for ${field.label}.` }
    if (field.type === 'date' && !isCalendarDate(text)) return { ok: false as const, message: `Enter a valid date for ${field.label}.` }
    if (field.type === 'rating' && (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 5)) return { ok: false as const, message: `Choose a rating from 1 to 5 for ${field.label}.` }
    if (['dropdown', 'radio'].includes(field.type) && !field.options.some((option) => option.id === text)) return { ok: false as const, message: `Choose a valid option for ${field.label}.` }
    normalized[field.id] = field.type === 'number' ? Number(text) : text
  }
  return { ok: true as const, answers: normalized }
}

export const slugFromTitle = (title: string) => title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'form'

export const safeCsvCell = (value: unknown) => {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '')
  const safe = /^[\s\u0000-\u001f]*[=+@\-]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
