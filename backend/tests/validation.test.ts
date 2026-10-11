import test from 'node:test'
import assert from 'node:assert/strict'
import { Types } from 'mongoose'
import { formDefinitionSchema, safeCsvCell, slugFromTitle, toPlainFormFields, validateSubmissionAnswers } from '../src/validation.js'
import { Form } from '../src/models.js'
import type { FormField } from '../src/types.js'

const fields: FormField[] = [
  { id: 'email-1', type: 'email', label: 'Email', required: true, options: [] },
  { id: 'rating-1', type: 'rating', label: 'Rating', required: false, options: [] },
  { id: 'check-1', type: 'checkbox', label: 'Interests', required: false, options: [{ id: 'web', label: 'Web' }, { id: 'ai', label: 'AI' }] },
]

test('form schema rejects duplicate IDs and choice questions without options', () => {
  assert.equal(formDefinitionSchema.safeParse({ version: 1, fields: [{ ...fields[1], id: 'same' }, { ...fields[1], id: 'same' }] }).success, false)
  assert.equal(formDefinitionSchema.safeParse({ version: 1, fields: [{ id: 'pick', type: 'radio', label: 'Pick one', required: false, options: [] }] }).success, false)
})

test('persisted Mongoose question subdocuments normalize to strict public field data', () => {
  const sourceFields: FormField[] = [
    { id: 'short', type: 'short_text', label: 'Name', description: '', placeholder: '', required: true, options: [] },
    { id: 'long', type: 'long_text', label: 'Details', description: '', placeholder: '', required: false, options: [] },
    { id: 'email', type: 'email', label: 'Email', description: '', placeholder: '', required: true, options: [] },
    { id: 'number', type: 'number', label: 'Age', description: '', placeholder: '', required: false, options: [] },
    { id: 'dropdown', type: 'dropdown', label: 'Role', description: '', placeholder: '', required: false, options: [{ id: 'dev', label: 'Developer' }] },
    { id: 'radio', type: 'radio', label: 'Plan', description: '', placeholder: '', required: false, options: [{ id: 'free', label: 'Free' }] },
    { id: 'checkbox', type: 'checkbox', label: 'Topics', description: '', placeholder: '', required: false, options: [{ id: 'ai', label: 'AI' }] },
    { id: 'date', type: 'date', label: 'Date', description: '', placeholder: '', required: false, options: [] },
    { id: 'rating', type: 'rating', label: 'Rating', description: '', placeholder: '', required: false, options: [] },
  ]
  const document = new Form({ owner: new Types.ObjectId(), title: 'All question types', slug: 'all-question-types', fields: sourceFields })
  assert.equal(formDefinitionSchema.safeParse({ version: 1, fields: document.fields }).success, false)

  const fields = toPlainFormFields(document.fields)
  assert.equal(formDefinitionSchema.safeParse({ version: 1, fields }).success, true)
  assert.deepEqual(fields[4]?.options, [{ id: 'dev', label: 'Developer' }])
})

test('submission validator enforces required and validates option membership', () => {
  assert.equal(validateSubmissionAnswers(fields, {}).ok, false)
  assert.equal(validateSubmissionAnswers(fields, { 'email-1': 'bad', 'check-1': ['unknown'] }).ok, false)
  const valid = validateSubmissionAnswers(fields, { 'email-1': 'person@example.com', 'rating-1': '5', 'check-1': ['web', 'ai'] })
  assert.equal(valid.ok, true)
})

test('submission validator rejects impossible dates and out-of-range ratings', () => {
  const extraFields: FormField[] = [
    { id: 'date', type: 'date', label: 'Event date', required: false, options: [] },
    { id: 'rating', type: 'rating', label: 'Rating', required: false, options: [] },
  ]
  assert.equal(validateSubmissionAnswers(extraFields, { date: '2025-02-29', rating: '5' }).ok, false)
  assert.equal(validateSubmissionAnswers(extraFields, { date: '2024-02-29', rating: '6' }).ok, false)
  assert.equal(validateSubmissionAnswers(extraFields, { date: '2024-02-29', rating: '5' }).ok, true)
})

test('slug and CSV helpers normalize titles and neutralize formula cells', () => {
  assert.equal(slugFromTitle('Réponse rapide!'), 'reponse-rapide')
  assert.equal(safeCsvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
})
