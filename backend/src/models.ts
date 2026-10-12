import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const defineModel = <T>(name: string, schema: Schema<T>, collection: string): Model<T> => {
  const existing = mongoose.models[name] as Model<T> | undefined
  return existing || model<T>(name, schema, collection)
}

const optionSchema = new Schema({ id: { type: String, required: true }, label: { type: String, required: true } }, { _id: false })
const fieldSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
  options: { type: [optionSchema], default: [] },
}, { _id: false })

const formSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'TajFormsUser', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 600 },
  coverImage: { type: String, default: '', maxlength: 850000 },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  definitionVersion: { type: Number, default: 1 },
  fields: { type: [fieldSchema], default: [] },
  theme: {
    accent: { type: String, default: '#4f46e5' },
    background: { type: String, default: '#f7f8fc' },
    layout: { type: String, enum: ['classic', 'compact'], default: 'classic' },
  },
  confirmationMessage: { type: String, default: 'Thanks — your response has been recorded.', maxlength: 500 },
  publishedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
}, { timestamps: true, minimize: false })
formSchema.index({ owner: 1, updatedAt: -1 })
formSchema.index({ status: 1, publishedAt: -1 })

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', immutable: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true })

const previousCsrfSchema = new Schema({
  hash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { _id: false })

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  csrfHash: { type: String, required: true },
  csrfPreviousHashes: { type: [previousCsrfSchema], default: [] },
  user: { type: Schema.Types.ObjectId, ref: 'TajFormsUser', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true })

const submissionSchema = new Schema({
  form: { type: Schema.Types.ObjectId, ref: 'TajFormsForm', required: true },
  formOwner: { type: Schema.Types.ObjectId, ref: 'TajFormsUser', required: true },
  answers: { type: Map, of: Schema.Types.Mixed, required: true },
  submittedAt: { type: Date, default: Date.now },
  ipHash: { type: String, select: false },
}, { timestamps: true, minimize: false })
submissionSchema.index({ form: 1, submittedAt: -1 })
submissionSchema.index({ formOwner: 1, submittedAt: -1 })

const reportSchema = new Schema({
  form: { type: Schema.Types.ObjectId, ref: 'TajFormsForm', default: null },
  slug: { type: String, maxlength: 100 },
  reason: { type: String, enum: ['spam', 'phishing', 'harassment', 'other'], required: true },
  details: { type: String, default: '', maxlength: 1200 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open', index: true },
  reporterEmail: { type: String, default: '', maxlength: 254 },
}, { timestamps: true })
reportSchema.index({ status: 1, createdAt: -1 })

const auditSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: 'TajFormsUser', required: true },
  action: { type: String, required: true, maxlength: 100 },
  targetType: { type: String, required: true, maxlength: 50 },
  targetId: { type: String, default: '', maxlength: 100 },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, minimize: false })
auditSchema.index({ createdAt: -1 })

const settingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true })

export type FormRecord = InferSchemaType<typeof formSchema>
export const User = defineModel('TajFormsUser', userSchema, 'users')
export const Session = defineModel('TajFormsSession', sessionSchema, 'sessions')
export const Form = defineModel('TajFormsForm', formSchema, 'forms')
export const Submission = defineModel('TajFormsSubmission', submissionSchema, 'submissions')
export const AbuseReport = defineModel('TajFormsReport', reportSchema, 'abuse_reports')
export const AdminAuditLog = defineModel('TajFormsAudit', auditSchema, 'admin_audit_logs')
export const PlatformSetting = defineModel('TajFormsSetting', settingSchema, 'platform_settings')
