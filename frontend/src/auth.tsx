import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setCsrfToken } from './api'
import type { User } from './types'

type AuthContextValue = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<User>; register: (name: string, email: string, password: string) => Promise<User>; logout: () => Promise<void>; refresh: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = async () => {
    try { const data = await api<{ user: User; csrfToken: string }>('/auth/me'); setUser(data.user); setCsrfToken(data.csrfToken) }
    catch (error: any) { if (error.status === 401) { setUser(null); setCsrfToken('') } else console.warn('[TAJ Forms] Session check failed', error.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  const login = async (email: string, password: string) => {
    const data = await api<{ user: User; csrfToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    setCsrfToken(data.csrfToken); setUser(data.user); return data.user
  }
  const register = async (name: string, email: string, password: string) => {
    const data = await api<{ user: User; csrfToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) })
    setCsrfToken(data.csrfToken); setUser(data.user); return data.user
  }
  const logout = async () => { try { await api('/auth/logout', { method: 'POST', body: JSON.stringify({}) }) } finally { setUser(null); setCsrfToken('') } }
  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
