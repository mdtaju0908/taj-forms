const envApi = import.meta.env.VITE_API_BASE_URL as string | undefined
export const apiBase = (envApi || (import.meta.env.DEV ? 'http://localhost:5010/forms/v1' : 'https://api.mdtaju.tech/forms/v1')).replace(/\/$/, '')
let csrfToken = ''
export const setCsrfToken = (value: string) => { csrfToken = value }
export const getCsrfToken = () => csrfToken

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(String(init.method || 'GET').toUpperCase()) && csrfToken) headers.set('X-CSRF-Token', csrfToken)
  const response = await fetch(`${apiBase}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers, credentials: 'include' })
  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : await response.blob()
  if (!response.ok) {
    const error = new Error((payload as any)?.message || `Request failed (${response.status})`) as Error & { status: number; payload: any }
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload as T
}

export const apiUrl = (path: string) => `${apiBase}${path.startsWith('/') ? path : `/${path}`}`
