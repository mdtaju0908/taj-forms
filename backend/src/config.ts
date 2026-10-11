import 'dotenv/config'
import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5010),
  MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().trim().min(1).default('taj_forms'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5174/forms'),
  ADMIN_APP_URL: z.string().url().default('http://localhost:5175/forms'),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('taj_forms_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(14),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5174,http://localhost:5175,https://mdtaju.tech,https://admin.mdtaju.tech'),
  ADMIN_BOOTSTRAP_EMAIL: z.preprocess((value) => value === '' ? undefined : value, z.string().email().optional()),
  ADMIN_BOOTSTRAP_PASSWORD: z.preprocess((value) => value === '' ? undefined : value, z.string().min(16).optional()),
})

const environment = { ...process.env }
// Make the npm dev command behave as development even if the parent shell exports NODE_ENV=production.
if (process.env.npm_lifecycle_event === 'dev') {
  environment.NODE_ENV = 'development'
}
// For local development, default to the dedicated local TAJ Forms database.
// Production must always provide its own MongoDB URI explicitly.
if (environment.NODE_ENV !== 'production' && !environment.MONGODB_URI) {
  environment.MONGODB_URI = 'mongodb://127.0.0.1:27017'
}

const parsed = configSchema.safeParse(environment)
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
  throw new Error(`Invalid TAJ Forms API configuration: ${details}`)
}

const allowedOrigins = parsed.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
if (!allowedOrigins.length) throw new Error('ALLOWED_ORIGINS must contain at least one HTTP(S) origin.')
for (const origin of allowedOrigins) {
  let parsedOrigin: URL
  try { parsedOrigin = new URL(origin) } catch { throw new Error(`Invalid TAJ Forms ALLOWED_ORIGINS entry: ${origin}`) }
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
    throw new Error(`ALLOWED_ORIGINS entries must be exact HTTP(S) origins without paths: ${origin}`)
  }
}

export const config = {
  ...parsed.data,
  allowedOrigins: new Set(allowedOrigins),
  secureCookies: parsed.data.NODE_ENV === 'production',
  sessionTtlMs: parsed.data.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
}
