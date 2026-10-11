export type FieldType = 'short_text' | 'long_text' | 'email' | 'number' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'rating'
export type Option = { id: string; label: string }
export type Answer = string | string[]
export type FormField = { id: string; type: FieldType; label: string; description: string; placeholder: string; required: boolean; options: Option[] }
export type FormRecord = { _id: string; title: string; description: string; slug: string; status: 'draft' | 'published' | 'archived'; fields: FormField[]; theme: { accent: string; background: string; layout: 'classic' | 'compact' }; confirmationMessage: string; submissionCount?: number; updatedAt: string }
export type User = { id: string; email: string; name: string; role: 'user' | 'admin'; status: 'active' | 'suspended' }
export const fieldTypes: { type: FieldType; label: string; help: string }[] = [
  { type: 'short_text', label: 'Short answer', help: 'A single line of text' },
  { type: 'long_text', label: 'Long answer', help: 'A longer written response' },
  { type: 'email', label: 'Email', help: 'Email address' },
  { type: 'number', label: 'Number', help: 'Numeric answer' },
  { type: 'dropdown', label: 'Dropdown', help: 'Choose one option' },
  { type: 'radio', label: 'Single choice', help: 'Select one option' },
  { type: 'checkbox', label: 'Multiple choice', help: 'Select any options' },
  { type: 'date', label: 'Date', help: 'Pick a date' },
  { type: 'rating', label: 'Rating', help: 'Rate from 1 to 5' },
]
