import type { Request } from 'express'
import type { Types } from 'mongoose'

export type UserRole = 'user' | 'admin'
export type FormStatus = 'draft' | 'published' | 'archived'
export type FieldType = 'short_text' | 'long_text' | 'email' | 'number' | 'dropdown' | 'radio' | 'checkbox' | 'date' | 'rating'

export type FormOption = { id: string; label: string }
export type FormField = {
  id: string
  type: FieldType
  label: string
  description?: string
  placeholder?: string
  required: boolean
  options: FormOption[]
}
export type FormDefinition = { version: 1; fields: FormField[] }
export type FormTheme = { accent: string; background: string; layout: 'classic' | 'compact' }

export type SessionUser = { id: string; email: string; name: string; role: UserRole; status: 'active' | 'suspended' }
export type AuthedRequest = Request & { user?: SessionUser; sessionCsrf?: string; sessionCsrfPrevious?: { hash: string; expiresAt: Date }[] }

export type Id = Types.ObjectId | string
