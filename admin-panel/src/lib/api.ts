export const apiBase = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5010/forms/v1' : 'https://api.mdtaju.tech/forms/v1')).replace(/\/$/, '')
let csrfToken = ''
export const setCsrfToken = (value: string) => { csrfToken = value }

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(String(init.method || 'GET').toUpperCase()) && csrfToken) headers.set('X-CSRF-Token', csrfToken)
  const response = await fetch(`${apiBase}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers, credentials: 'include' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`)
  return body as T
}
