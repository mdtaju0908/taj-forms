import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowRight, FilePlus2, LayoutDashboard, LogOut, Settings2, Sparkles } from 'lucide-react'
import { useAuth } from './auth'
import { LandingPage } from './pages/LandingPage'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { BuilderPage } from './pages/BuilderPage'
import { PublicFormPage } from './pages/PublicFormPage'
import { ResponsesPage } from './pages/ResponsesPage'
import { SettingsPage } from './pages/SettingsPage'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="page-loader"><span className="spinner" /> Restoring your session…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function Workspace({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  return <div className="workspace">
    <aside className="workspace-rail">
      <Link to="/dashboard" className="brand-mark" aria-label="TAJ Forms dashboard">T<span>.</span></Link>
      <nav aria-label="Workspace navigation">
        <Link to="/dashboard" title="My forms"><LayoutDashboard size={19}/><span>Forms</span></Link>
        <Link to="/dashboard?create=1" title="Create a form"><FilePlus2 size={19}/><span>New form</span></Link>
        <Link to="/settings" title="Settings"><Settings2 size={19}/><span>Settings</span></Link>
      </nav>
      <div className="rail-bottom"><span className="avatar">{user?.name.slice(0, 1).toUpperCase()}</span><button className="icon-button" onClick={() => void logout()} title="Sign out" aria-label="Sign out"><LogOut size={17}/></button></div>
    </aside>
    <div className="workspace-main"><header className="workspace-topbar"><Link to="/dashboard" className="wordmark">TAJ<span>Forms</span></Link><div className="topbar-right"><span className="beta-pill"><Sparkles size={13}/> Beta</span><span className="user-chip">{user?.name}</span></div></header>{children}</div>
  </div>
}

function ProtectedWorkspace({ children }: { children: React.ReactNode }) {
  return <Protected><Workspace>{children}</Workspace></Protected>
}

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/login" element={<AuthPage mode="login"/>}/>
    <Route path="/signup" element={<AuthPage mode="signup"/>}/>
    <Route path="/f/:slug" element={<PublicFormPage/>}/>
    <Route path="/dashboard" element={<ProtectedWorkspace><DashboardPage/></ProtectedWorkspace>}/>
    <Route path="/builder/:formId" element={<ProtectedWorkspace><BuilderPage/></ProtectedWorkspace>}/>
    <Route path="/responses/:formId" element={<ProtectedWorkspace><ResponsesPage/></ProtectedWorkspace>}/>
    <Route path="/settings" element={<ProtectedWorkspace><SettingsPage/></ProtectedWorkspace>}/>
    <Route path="*" element={<main className="center-card"><h1>Page not found</h1><p>That TAJ Forms page doesn’t exist.</p><Link className="button button-primary" to="/">Back to forms <ArrowRight size={16}/></Link></main>}/>
  </Routes>
}
