import { useState, type FormEvent } from 'react'
import { Check, KeyRound, UserRound } from 'lucide-react'
import { useAuth } from '../auth'
import { api } from '../api'

export function SettingsPage() {
  const { user, refresh } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await api('/settings/account', { method: 'PATCH', body: JSON.stringify({ name }) }); await refresh(); setNotice('Profile updated.') }
    catch (reason: any) { setError(reason.message || 'Could not update profile.') }
    finally { setBusy(false) }
  }
  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }); setCurrentPassword(''); setNewPassword(''); await refresh(); setNotice('Password updated. Sign in again with the new password.') }
    catch (reason: any) { setError(reason.message || 'Could not update password.') }
    finally { setBusy(false) }
  }
  return <main className="workspace-content"><div className="page-heading"><div><span className="eyebrow">Workspace preferences</span><h1>Account settings</h1><p>Manage your TAJ Forms profile and sign-in security.</p></div></div>{error && <div className="form-error">{error}</div>}{notice && <div className="success-note"><Check size={15}/> {notice}</div>}
    <section className="settings-card"><div className="settings-title"><span className="feature-icon"><UserRound size={18}/></span><div><h2>Profile</h2><p>Change the name displayed in your workspace.</p></div></div><form onSubmit={(event) => void saveProfile(event)}><label className="compact-label" htmlFor="profile-name">Display name</label><input id="profile-name" className="text-input" value={name} minLength={2} maxLength={80} onChange={(event) => setName(event.target.value)} required/><label className="compact-label" htmlFor="profile-email">Email</label><input id="profile-email" className="text-input" value={user?.email || ''} readOnly/><div className="settings-actions"><button className="button button-primary" disabled={busy}>Save profile</button></div></form></section>
    <section className="settings-card"><div className="settings-title"><span className="feature-icon mint"><KeyRound size={18}/></span><div><h2>Password</h2><p>Use at least 10 characters for your new password.</p></div></div><form onSubmit={(event) => void savePassword(event)}><label className="compact-label" htmlFor="current-password">Current password</label><input id="current-password" type="password" autoComplete="current-password" className="text-input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required/><label className="compact-label" htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" className="text-input" value={newPassword} minLength={10} maxLength={128} onChange={(event) => setNewPassword(event.target.value)} required/><div className="settings-actions"><button className="button button-primary" disabled={busy}>Update password</button></div></form></section>
  </main>
}
