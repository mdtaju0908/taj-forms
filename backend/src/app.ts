import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import mongoose, { Types } from 'mongoose'
import { z } from 'zod'
import { config } from './config.js'
import { AbuseReport, AdminAuditLog, Form, PlatformSetting, Session, Submission, User } from './models.js'
import { formCreateSchema, formDefinitionSchema, formPatchSchema, loginSchema, registerSchema, reportSchema, safeCsvCell, slugFromTitle, toPlainFormFields, validateSubmissionAnswers } from './validation.js'
import type { AuthedRequest, FormField, SessionUser } from './types.js'

const API_PREFIX = '/forms/v1'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')
const asyncRoute = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req, res, next).catch(next) }
const safeUser = (user: any): SessionUser => ({ id: String(user._id), email: user.email, name: user.name, role: user.role, status: user.status })
const cookieOptions = () => ({ httpOnly: true, secure: config.secureCookies, sameSite: 'lax' as const, path: '/forms', maxAge: config.sessionTtlMs })
const trustedOrigin = (req: Request) => {
  const origin = req.get('origin')
  if (!origin) return false
  try { return config.allowedOrigins.has(new URL(origin).origin) } catch { return false }
}
const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction) => {
  if (!trustedOrigin(req)) return res.status(403).json({ message: 'Request origin is not allowed.' })
  next()
}
const requireSession = asyncRoute(async (req, res, next) => {
  const token = req.cookies?.[config.SESSION_COOKIE_NAME]
  if (!token || typeof token !== 'string') return res.status(401).json({ message: 'Sign in to continue.' })
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } }).populate('user')
  const user: any = session?.user
  if (!session || !user || user.status !== 'active') return res.status(401).json({ message: 'Your session is no longer active.' })
  ;(req as AuthedRequest).user = safeUser(user)
  ;(req as AuthedRequest).sessionCsrf = session.csrfHash
  ;(req as AuthedRequest).sessionCsrfPrevious = session.csrfPreviousHashes || []
  next()
})
const requireCsrf = asyncRoute(async (req, res, next) => {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next()
  if (!trustedOrigin(req)) return res.status(403).json({ message: 'Request origin is not allowed.' })
  const provided = req.get('x-csrf-token') || ''
  const expected = (req as AuthedRequest).sessionCsrf || ''
  if (!provided || !expected) return res.status(403).json({ message: 'Refresh your session and try again.' })
  const providedHash = Buffer.from(hash(provided))
  const matches = (storedHash: string) => {
    const expectedHash = Buffer.from(storedHash)
    return providedHash.length === expectedHash.length && timingSafeEqual(providedHash, expectedHash)
  }
  const currentMatch = matches(expected)
  const previousMatch = (req as AuthedRequest).sessionCsrfPrevious?.some((entry) => entry.expiresAt > new Date() && matches(entry.hash)) || false
  if (!currentMatch && !previousMatch) return res.status(403).json({ message: 'The security token expired. Refresh and try again.' })
  next()
})
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as AuthedRequest).user
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Platform administrator access is required.' })
  next()
}
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many authentication attempts. Try again in 15 minutes.' } })
const submissionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many submissions from this network. Try again later.' } })
const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many abuse reports from this network. Try again later.' } })

const appendAudit = async (actor: string, action: string, targetType: string, targetId = '', metadata: Record<string, unknown> = {}) => {
  await AdminAuditLog.create({ actor: new Types.ObjectId(actor), action, targetType, targetId, metadata })
}
const defaultSettings = { publicSignup: true, maxFormsPerUser: 20, maxSubmissionsPerForm: 5000, maintenanceMode: false }
const getSettings = async () => {
  const saved: any = await PlatformSetting.findOne({ key: 'platform' }).lean()
  return { ...defaultSettings, ...(saved?.value || {}) }
}
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pagination = (query: any) => {
  const page = Math.max(1, Math.min(100000, Number.parseInt(String(query.page || '1'), 10) || 1))
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(query.limit || '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}
const ownForm = async (userId: string, formId: string) => {
  if (!Types.ObjectId.isValid(formId)) return null
  return Form.findOne({ _id: formId, owner: new Types.ObjectId(userId) })
}
const allocateSlug = async (title: string, excludeFormId?: string) => {
  const base = slugFromTitle(title).slice(0, 48)
  for (let index = 0; index < 8; index += 1) {
    const candidate = index === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`
    const exists = await Form.exists(excludeFormId ? { slug: candidate, _id: { $ne: new Types.ObjectId(excludeFormId) } } : { slug: candidate })
    if (!exists) return candidate
  }
  return `${base}-${randomBytes(6).toString('hex')}`
}
const publicForm = (form: any) => ({
  title: form.title, description: form.description, coverImage: form.coverImage || '', slug: form.slug,
  fields: toPlainFormFields(form.fields), theme: form.theme, confirmationMessage: form.confirmationMessage,
})
const formRouter = express.Router()

formRouter.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1
  res.status(connected ? 200 : 503).json({ success: connected, service: 'taj-forms-api', database: connected ? 'connected' : 'disconnected' })
})

// Auth is deliberately separate from the portfolio API session and collections.
formRouter.post('/auth/register', authLimiter, requireTrustedOrigin, asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Check the registration details.' })
  const settings = await getSettings()
  if (!settings.publicSignup) return res.status(403).json({ message: 'New account registration is temporarily closed.' })
  const email = parsed.data.email.toLowerCase()
  if (await User.exists({ email })) return res.status(409).json({ message: 'An account already exists for this email.' })
  const user = await User.create({ email, name: parsed.data.name, passwordHash: await bcrypt.hash(parsed.data.password, 12) })
  const token = newToken()
  const csrf = newToken()
  await Session.create({ tokenHash: hash(token), csrfHash: hash(csrf), user: user._id, expiresAt: new Date(Date.now() + config.sessionTtlMs) })
  res.cookie(config.SESSION_COOKIE_NAME, token, cookieOptions())
  res.status(201).json({ user: safeUser(user), csrfToken: csrf })
}))

formRouter.post('/auth/login', authLimiter, requireTrustedOrigin, asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and password.' })
  const user: any = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash')
  if (!user || user.status !== 'active' || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
  const token = newToken()
  const csrf = newToken()
  await Session.create({ tokenHash: hash(token), csrfHash: hash(csrf), user: user._id, expiresAt: new Date(Date.now() + config.sessionTtlMs) })
  user.lastLoginAt = new Date()
  await user.save()
  res.cookie(config.SESSION_COOKIE_NAME, token, cookieOptions())
  res.json({ user: safeUser(user), csrfToken: csrf })
}))

formRouter.get('/auth/me', requireSession, asyncRoute(async (req, res) => {
  const token = req.cookies?.[config.SESSION_COOKIE_NAME] as string
  const csrfToken = newToken()
  const previousHash = (req as AuthedRequest).sessionCsrf
  const prior = previousHash ? [{ hash: previousHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) }] : []
  await Session.updateOne({ tokenHash: hash(token) }, { $set: { csrfHash: hash(csrfToken) }, $push: { csrfPreviousHashes: { $each: prior, $slice: -10 } } })
  res.json({ user: (req as AuthedRequest).user, csrfToken })
}))

formRouter.post('/auth/logout', requireSession, requireCsrf, asyncRoute(async (req, res) => {
  const token = req.cookies?.[config.SESSION_COOKIE_NAME] as string
  await Session.deleteOne({ tokenHash: hash(token) })
  res.clearCookie(config.SESSION_COOKIE_NAME, { httpOnly: true, secure: config.secureCookies, sameSite: 'lax', path: '/forms' })
  res.json({ success: true })
}))

formRouter.patch('/auth/me', requireSession, requireCsrf, asyncRoute(async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2).max(80).optional(), currentPassword: z.string().max(128).optional(), newPassword: z.string().min(10).max(128).optional() }).strict().refine((body) => Object.keys(body).length > 0)
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Check the profile details.' })
  const user: any = await User.findById((req as AuthedRequest).user?.id).select('+passwordHash')
  if (!user) return res.status(404).json({ message: 'Account not found.' })
  if (parsed.data.newPassword) {
    if (!parsed.data.currentPassword || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) return res.status(400).json({ message: 'Current password is incorrect.' })
    user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
    await Session.deleteMany({ user: user._id })
  }
  if (parsed.data.name) user.name = parsed.data.name
  await user.save()
  res.json({ user: safeUser(user), message: 'Account settings saved. Sign in again if you changed your password.' })
}))

// Authenticated member routes are isolated under /forms and always scoped to the owner.
formRouter.use('/forms', requireSession, requireCsrf)

formRouter.get('/forms', asyncRoute(async (req, res) => {
  const userId = (req as AuthedRequest).user!.id
  const { page, limit, skip } = pagination(req.query)
  const filter: any = { owner: new Types.ObjectId(userId), status: { $ne: 'archived' } }
  if (['draft', 'published', 'archived'].includes(String(req.query.status))) filter.status = String(req.query.status)
  if (typeof req.query.q === 'string' && req.query.q.trim()) filter.$or = [{ title: { $regex: escapeRegex(req.query.q.trim().slice(0, 80)), $options: 'i' } }, { slug: { $regex: escapeRegex(req.query.q.trim().slice(0, 80)), $options: 'i' } }]
  const [forms, total] = await Promise.all([Form.find(filter).select('-coverImage').sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(), Form.countDocuments(filter)])
  const counts = await Submission.aggregate([{ $match: { form: { $in: forms.map((form: any) => form._id) } } }, { $group: { _id: '$form', count: { $sum: 1 } } }])
  const countMap = new Map(counts.map((entry: any) => [String(entry._id), entry.count]))
  res.json({ data: forms.map((form: any) => ({ ...form, submissionCount: countMap.get(String(form._id)) || 0 })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

formRouter.post('/forms', asyncRoute(async (req, res) => {
  const parsed = formCreateSchema.safeParse(req.body || {})
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid form details.' })
  const user = (req as AuthedRequest).user!
  const settings = await getSettings()
  const count = await Form.countDocuments({ owner: new Types.ObjectId(user.id), status: { $ne: 'archived' } })
  if (count >= Number(settings.maxFormsPerUser || 20)) return res.status(409).json({ message: `Your plan allows up to ${settings.maxFormsPerUser} active forms.` })
  const form = await Form.create({ owner: new Types.ObjectId(user.id), title: parsed.data.title, slug: await allocateSlug(parsed.data.title), fields: [] })
  res.status(201).json({ data: form })
}))

formRouter.get('/forms/:formId', asyncRoute(async (req, res) => {
  const form = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!form || form.status === 'archived') return res.status(404).json({ message: 'Form not found.' })
  res.json({ data: form })
}))

formRouter.patch('/forms/:formId', asyncRoute(async (req, res) => {
  const parsed = formPatchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid form changes.' })
  if (parsed.data.fields) {
    const validation = formDefinitionSchema.safeParse({ version: parsed.data.definitionVersion || 1, fields: parsed.data.fields })
    if (!validation.success) return res.status(400).json({ message: validation.error.issues[0]?.message || 'Invalid question settings.' })
  }
  const form: any = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!form) return res.status(404).json({ message: 'Form not found.' })
  if (form.status === 'archived' && parsed.data.status === 'draft') {
    const settings = await getSettings()
    const activeCount = await Form.countDocuments({ owner: form.owner, status: { $ne: 'archived' } })
    if (activeCount >= Number(settings.maxFormsPerUser || 20)) return res.status(409).json({ message: `Your plan allows up to ${settings.maxFormsPerUser} active forms. Archive another form before restoring this one.` })
  }
  if (form.status === 'archived' && parsed.data.status !== 'draft') return res.status(409).json({ message: 'Restore the form before editing it.' })
  if (parsed.data.title !== undefined && parsed.data.title !== form.title && form.status === 'draft') {
    form.slug = await allocateSlug(parsed.data.title, String(form._id))
  }
  Object.assign(form, parsed.data)
  if (parsed.data.status === 'archived') { form.archivedAt = new Date(); form.publishedAt = null }
  if (parsed.data.status === 'draft') { form.archivedAt = null; form.publishedAt = null }
  await form.save()
  res.json({ data: form })
}))

formRouter.post('/forms/:formId/duplicate', asyncRoute(async (req, res) => {
  const original: any = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!original) return res.status(404).json({ message: 'Form not found.' })
  if (original.status === 'archived') return res.status(409).json({ message: 'Restore the form before duplicating it.' })
  const user = (req as AuthedRequest).user!
  const settings = await getSettings()
  const count = await Form.countDocuments({ owner: new Types.ObjectId(user.id), status: { $ne: 'archived' } })
  if (count >= Number(settings.maxFormsPerUser || 20)) return res.status(409).json({ message: `Your plan allows up to ${settings.maxFormsPerUser} active forms.` })
  const duplicate = await Form.create({ owner: new Types.ObjectId(user.id), title: `${original.title} copy`.slice(0, 120), description: original.description, coverImage: original.coverImage || '', slug: await allocateSlug(`${original.title} copy`), fields: toPlainFormFields(original.fields), theme: original.theme, confirmationMessage: original.confirmationMessage, status: 'draft' })
  res.status(201).json({ data: duplicate })
}))

formRouter.delete('/forms/:formId', asyncRoute(async (req, res) => {
  const form: any = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!form) return res.status(404).json({ message: 'Form not found.' })
  await Promise.all([Submission.deleteMany({ form: form._id }), form.deleteOne()])
  res.json({ success: true })
}))

formRouter.post('/forms/:formId/publish', asyncRoute(async (req, res) => {
  const form: any = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!form) return res.status(404).json({ message: 'Form not found.' })
  if (form.status === 'archived') return res.status(409).json({ message: 'Restore the form before publishing it.' })
  if (!form.title.trim() || form.fields.length < 1) return res.status(400).json({ message: 'Add a title and at least one question before publishing.' })
  const validated = formDefinitionSchema.safeParse({ version: form.definitionVersion || 1, fields: toPlainFormFields(form.fields) })
  if (!validated.success) return res.status(400).json({ message: validated.error.issues[0]?.message || 'Fix invalid question settings before publishing.' })
  form.fields = validated.data.fields
  form.status = 'published'
  form.publishedAt = new Date()
  form.archivedAt = null
  await form.save()
  res.json({ data: form })
}))

formRouter.post('/forms/:formId/unpublish', asyncRoute(async (req, res) => {
  const form: any = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!form) return res.status(404).json({ message: 'Form not found.' })
  if (form.status === 'archived') return res.status(409).json({ message: 'Restore the form before unpublishing it.' })
  form.status = 'draft'
  form.publishedAt = null
  await form.save()
  res.json({ data: form })
}))

formRouter.get('/forms/:formId/submissions', asyncRoute(async (req, res) => {
  const form: any = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!form) return res.status(404).json({ message: 'Form not found.' })
  const { page, limit, skip } = pagination(req.query)
  const query: any = { form: form._id }
  const search = String(req.query.q || '').trim().slice(0, 80)
  if (search) {
    const matching = toPlainFormFields(form.fields)
    query.$or = matching.map((field) => ({ [`answers.${field.id}`]: { $regex: escapeRegex(search), $options: 'i' } }))
    if (!query.$or.length) query.submittedAt = { $exists: false }
  }
  const [data, total] = await Promise.all([Submission.find(query).sort({ submittedAt: -1 }).skip(skip).limit(limit).select('-ipHash').lean(), Submission.countDocuments(query)])
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

formRouter.get('/forms/:formId/submissions.csv', asyncRoute(async (req, res) => {
  const form: any = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!form) return res.status(404).json({ message: 'Form not found.' })
  const rows = await Submission.find({ form: form._id }).sort({ submittedAt: -1 }).limit(10000).select('-ipHash').lean()
  const fields = toPlainFormFields(form.fields)
  const headers = ['Submitted at', ...fields.map((field) => field.label)]
  const csvAnswer = (field: FormField, raw: unknown) => {
    const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw]
    if (['dropdown', 'radio', 'checkbox'].includes(field.type)) return values.map((value) => field.options.find((option) => option.id === String(value))?.label || String(value)).join(', ')
    return Array.isArray(raw) ? raw.join(', ') : raw
  }
  const csv = [headers.map(safeCsvCell).join(','), ...rows.map((row: any) => [new Date(row.submittedAt).toISOString(), ...fields.map((field) => csvAnswer(field, row.answers?.[field.id]))].map(safeCsvCell).join(','))].join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${form.slug}-responses.csv"`)
  res.send(`\uFEFF${csv}`)
}))

formRouter.get('/forms/:formId/analytics', asyncRoute(async (req, res) => {
  const form: any = await ownForm((req as AuthedRequest).user!.id, req.params.formId!)
  if (!form) return res.status(404).json({ message: 'Form not found.' })
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - 29)
  const [total, trendRows, choiceAnswers] = await Promise.all([
    Submission.countDocuments({ form: form._id }),
    Submission.aggregate([{ $match: { form: form._id, submittedAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Submission.find({ form: form._id }).sort({ submittedAt: -1 }).limit(500).select('answers').lean(),
  ])
  const summary = toPlainFormFields(form.fields).filter((field) => ['dropdown', 'radio', 'checkbox', 'rating'].includes(field.type)).map((field) => {
    const counts = new Map<string, number>()
    for (const row of choiceAnswers as any[]) {
      const value = row.answers?.[field.id]
      const values = Array.isArray(value) ? value : value === undefined ? [] : [value]
      for (const item of values) counts.set(String(item), (counts.get(String(item)) || 0) + 1)
    }
    return { fieldId: field.id, label: field.label, answers: [...counts.entries()].map(([value, count]) => ({ value: field.options.find((option) => option.id === value)?.label || value, count })).sort((a, b) => b.count - a.count).slice(0, 12) }
  })
  res.json({ data: { totalSubmissions: total, last30Days: trendRows, fieldSummaries: summary, summarySampleSize: choiceAnswers.length } })
}))

formRouter.patch('/settings/account', requireSession, requireCsrf, asyncRoute(async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(80).optional() }).strict().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid display name.' })
  const user = await User.findByIdAndUpdate((req as AuthedRequest).user!.id, { $set: parsed.data }, { new: true, runValidators: true })
  res.json({ user: user ? safeUser(user) : null })
}))

// Public forms never expose owner or unpublished form data.
formRouter.get('/public/forms/:slug', asyncRoute(async (req, res) => {
  const form: any = await Form.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'published' }).lean()
  if (!form) return res.status(404).json({ message: 'This form is unavailable or no longer published.' })
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60')
  res.json({ data: publicForm(form) })
}))

formRouter.post('/public/forms/:slug/submissions', submissionLimiter, asyncRoute(async (req, res) => {
  const settings = await getSettings()
  if (settings.maintenanceMode) return res.status(503).json({ message: 'Form submissions are temporarily paused for maintenance.' })
  const form: any = await Form.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'published' })
  if (!form) return res.status(404).json({ message: 'This form is unavailable or no longer published.' })
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  // Quietly accept a filled honeypot so simple bots cannot use response errors to probe it.
  if (typeof body.website === 'string' && body.website.trim()) return res.status(202).json({ success: true, message: form.confirmationMessage })
  const answers = validateSubmissionAnswers(toPlainFormFields(form.fields), body.answers)
  if (!answers.ok) return res.status(400).json({ message: answers.message })
  const currentCount = await Submission.countDocuments({ form: form._id })
  if (currentCount >= Number(settings.maxSubmissionsPerForm || 5000)) return res.status(409).json({ message: 'This form has reached its response limit.' })
  await Submission.create({ form: form._id, formOwner: form.owner, answers: answers.answers })
  res.status(201).json({ success: true, message: form.confirmationMessage })
}))

formRouter.post('/public/forms/:slug/report', reportLimiter, asyncRoute(async (req, res) => {
  const parsed = reportSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Check the report.' })
  if (parsed.data.website) return res.status(202).json({ success: true })
  const form: any = await Form.findOne({ slug: String(req.params.slug).toLowerCase() }).select('_id slug').lean()
  await AbuseReport.create({ form: form?._id || null, slug: String(req.params.slug).slice(0, 100), reason: parsed.data.reason, details: parsed.data.details, reporterEmail: parsed.data.email || '' })
  res.status(201).json({ success: true })
}))

// Platform administration is explicit role-based access, provisioned only by the CLI bootstrap script.
formRouter.use('/admin', requireSession, requireCsrf, requireAdmin)
formRouter.get('/admin/overview', asyncRoute(async (_req, res) => {
  const [users, activeUsers, forms, publishedForms, submissions, openReports] = await Promise.all([
    User.countDocuments(), User.countDocuments({ status: 'active' }), Form.countDocuments(), Form.countDocuments({ status: 'published' }), Submission.countDocuments(), AbuseReport.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
  ])
  res.json({ data: { users, activeUsers, forms, publishedForms, submissions, openReports, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', uptimeSeconds: Math.floor(process.uptime()) } })
}))

formRouter.get('/admin/users', asyncRoute(async (req, res) => {
  const { page, limit, skip } = pagination(req.query)
  const q = String(req.query.q || '').trim().slice(0, 80)
  const filter: any = q ? { $or: [{ email: { $regex: escapeRegex(q), $options: 'i' } }, { name: { $regex: escapeRegex(q), $options: 'i' } }] } : {}
  const [data, total] = await Promise.all([User.find(filter).select('email name role status lastLoginAt createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(filter)])
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

formRouter.patch('/admin/users/:userId/status', asyncRoute(async (req, res) => {
  const parsed = z.object({ status: z.enum(['active', 'suspended']) }).strict().safeParse(req.body)
  if (!parsed.success || !Types.ObjectId.isValid(req.params.userId!)) return res.status(400).json({ message: 'Invalid user status update.' })
  const actor = (req as AuthedRequest).user!
  const target: any = await User.findById(req.params.userId!)
  if (!target) return res.status(404).json({ message: 'User not found.' })
  if (target.role === 'admin' || String(target._id) === actor.id) return res.status(409).json({ message: 'Administrators and your own account cannot be suspended here.' })
  target.status = parsed.data.status
  await target.save()
  if (target.status === 'suspended') await Session.deleteMany({ user: target._id })
  await appendAudit(actor.id, `user.${target.status}`, 'user', String(target._id), { role: target.role })
  res.json({ data: { id: String(target._id), email: target.email, status: target.status } })
}))

formRouter.get('/admin/forms', asyncRoute(async (req, res) => {
  const { page, limit, skip } = pagination(req.query)
  const q = String(req.query.q || '').trim().slice(0, 80)
  const filter: any = q ? { $or: [{ title: { $regex: escapeRegex(q), $options: 'i' } }, { slug: { $regex: escapeRegex(q), $options: 'i' } }] } : {}
  if (['draft', 'published', 'archived'].includes(String(req.query.status))) filter.status = String(req.query.status)
  const [data, total] = await Promise.all([Form.find(filter).select('-coverImage').populate('owner', 'email name').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Form.countDocuments(filter)])
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

formRouter.patch('/admin/forms/:formId/status', asyncRoute(async (req, res) => {
  const parsed = z.object({ status: z.enum(['draft', 'archived']) }).strict().safeParse(req.body)
  if (!parsed.success || !Types.ObjectId.isValid(req.params.formId!)) return res.status(400).json({ message: 'Invalid form status update.' })
  const form: any = await Form.findById(req.params.formId!)
  if (!form) return res.status(404).json({ message: 'Form not found.' })
  form.status = parsed.data.status
  form.publishedAt = null
  form.archivedAt = parsed.data.status === 'archived' ? new Date() : null
  await form.save()
  await appendAudit((req as AuthedRequest).user!.id, `form.${parsed.data.status}`, 'form', String(form._id), { slug: form.slug })
  res.json({ data: form })
}))

formRouter.get('/admin/reports', asyncRoute(async (req, res) => {
  const { page, limit, skip } = pagination(req.query)
  const filter: any = {}
  if (['open', 'reviewing', 'resolved', 'dismissed'].includes(String(req.query.status))) filter.status = String(req.query.status)
  const [data, total] = await Promise.all([AbuseReport.find(filter).populate('form', 'title slug').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AbuseReport.countDocuments(filter)])
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

formRouter.patch('/admin/reports/:reportId', asyncRoute(async (req, res) => {
  const parsed = z.object({ status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']) }).strict().safeParse(req.body)
  if (!parsed.success || !Types.ObjectId.isValid(req.params.reportId!)) return res.status(400).json({ message: 'Invalid report update.' })
  const report: any = await AbuseReport.findByIdAndUpdate(req.params.reportId!, { $set: { status: parsed.data.status } }, { new: true, runValidators: true })
  if (!report) return res.status(404).json({ message: 'Report not found.' })
  await appendAudit((req as AuthedRequest).user!.id, `report.${parsed.data.status}`, 'report', String(report._id))
  res.json({ data: report })
}))

formRouter.get('/admin/settings', asyncRoute(async (_req, res) => res.json({ data: await getSettings() })))
formRouter.patch('/admin/settings', asyncRoute(async (req, res) => {
  const parsed = z.object({ publicSignup: z.boolean().optional(), maxFormsPerUser: z.number().int().min(1).max(500).optional(), maxSubmissionsPerForm: z.number().int().min(1).max(1000000).optional(), maintenanceMode: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid platform settings.' })
  const current = await getSettings()
  const next = { ...current, ...parsed.data }
  await PlatformSetting.findOneAndUpdate({ key: 'platform' }, { $set: { value: next } }, { upsert: true, new: true, runValidators: true })
  await appendAudit((req as AuthedRequest).user!.id, 'settings.updated', 'platform_setting', 'platform', { updatedKeys: Object.keys(parsed.data) })
  res.json({ data: next })
}))

formRouter.get('/admin/audit-logs', asyncRoute(async (req, res) => {
  const { page, limit, skip } = pagination(req.query)
  const [data, total] = await Promise.all([AdminAuditLog.find().populate('actor', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AdminAuditLog.countDocuments()])
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
}))

export const createApp = () => {
  const app = express()
  app.disable('x-powered-by')
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || config.allowedOrigins.has(origin)), credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Accept'] }))
  app.options('*', cors({ origin: (origin, callback) => callback(null, !origin || config.allowedOrigins.has(origin)), credentials: true }))
  // Form definitions may include a resized cover image alongside the questions.
  app.use(express.json({ limit: '1.5mb', strict: true }))
  app.use(cookieParser())
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'OPTIONS') return next()
    next()
  })
  app.use(API_PREFIX, formRouter)
  app.use((_req, res) => res.status(404).json({ message: 'TAJ Forms endpoint not found.' }))
  const errorHandler: ErrorRequestHandler = (error: any, _req, res, _next) => {
    if (error?.name === 'ValidationError') return res.status(400).json({ message: 'The request contains invalid data.' })
    if (error?.code === 11000) return res.status(409).json({ message: 'That value is already in use.' })
    if (error?.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' })
    console.error('[TAJ Forms API]', error?.message || 'Unexpected error')
    res.status(500).json({ message: 'A server error occurred. Please try again.' })
  }
  app.use(errorHandler)
  return app
}

export const app = createApp()
