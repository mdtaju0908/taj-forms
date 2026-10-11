import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react'
import { useAuth } from '../auth'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup'
  const { login, register, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (user) return <main className="page-loader">You’re already signed in. <Link className="text-link" to="/dashboard">Open your dashboard</Link></main>
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      if (isSignup) await register(name, email, password)
      else await login(email, password)
      navigate((location.state as any)?.from || '/dashboard', { replace: true })
    } catch (cause: any) { setError(cause.message || 'Could not sign in. Try again.') }
    finally { setBusy(false) }
  }
  return <main className="auth-shell">
    <section className="auth-story"><Link className="wordmark" to="/" style={{ color: 'white' }}>TAJ<span style={{ color: '#c4c7d9' }}>Forms</span></Link><div><span className="eyebrow" style={{ background: '#ffffff16', color: '#dddafe', borderColor: '#ffffff24' }}><LockKeyhole size={13}/> Your workspace, your data</span><h1>{isSignup ? 'Make space for better questions.' : 'Welcome back to your workspace.'}</h1><p>Keep your forms organized, your responses private, and your next step easy to find.</p></div><div style={{ color: '#aeb2ca', fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}><span><Check size={14} style={{ verticalAlign: 'middle' }}/> Private forms</span><span><Check size={14} style={{ verticalAlign: 'middle' }}/> No card required</span></div></section>
    <section className="auth-card-wrap"><form className="auth-card" onSubmit={submit}><Link to="/" className="text-link" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}><ArrowLeft size={14}/> Back to TAJ Forms</Link><h2>{isSignup ? 'Create your account' : 'Sign in'}</h2><p>{isSignup ? 'Start your free beta workspace.' : 'Pick up where you left off.'}</p>{error && <div className="form-error" role="alert">{error}</div>}
      {isSignup && <><label className="field-label" htmlFor="name">Your name</label><input id="name" className="text-input" autoComplete="name" maxLength={80} required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Md Taju"/> </>}
      <label className="field-label" htmlFor="email">Email</label><input id="email" className="text-input" autoComplete="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"/>
      <label className="field-label" htmlFor="password">Password</label><input id="password" className="text-input" autoComplete={isSignup ? 'new-password' : 'current-password'} type="password" required minLength={isSignup ? 10 : 1} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSignup ? 'At least 10 characters' : 'Your password'}/>
      {isSignup && <p className="form-note" style={{ marginTop: 9 }}>Use at least 10 characters. The platform administrator role is never available through signup.</p>}
      <button disabled={busy} className="button button-primary full-width" style={{ marginTop: 24 }}>{busy ? 'Please wait…' : isSignup ? 'Create account' : 'Continue'} <ArrowRight size={16}/></button>
      <div className="auth-bottom">{isSignup ? 'Already have an account?' : 'New to TAJ Forms?'} <Link className="text-link" to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link></div>
    </form></section>
  </main>
}
