<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation'
  import { page } from '$app/state'
  import { api, setCsrfToken } from '$lib/api'
  import './app.css'

  let status: 'checking' | 'ready' | 'login' | 'denied' = 'checking'
  let adminName = 'Administrator'
  let active = ''
  let publicRoute = false

  $: active = page.url.pathname
  $: publicRoute = active.endsWith('/login')

  let authCheck = 0
  afterNavigate(() => {
    const checkId = ++authCheck
    active = page.url.pathname
    publicRoute = active.endsWith('/login')
    if (publicRoute) { status = 'login'; return }
    if (status === 'ready') return
    status = 'checking'
    api<{ user: { name: string; role: string; status: string }; csrfToken: string }>('/auth/me').then(({ user, csrfToken }) => {
      if (checkId !== authCheck) return
      if (user.role !== 'admin' || user.status !== 'active') { status = 'denied'; void goto('/forms/login'); return }
      adminName = user.name; setCsrfToken(csrfToken); status = 'ready'
    }).catch(() => { if (checkId === authCheck) { status = 'denied'; void goto('/forms/login') } })
  })

  async function signOut() { await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined); setCsrfToken(''); await goto('/forms/login') }
</script>

<svelte:head><title>TAJ Forms Admin</title><meta name="description" content="Manage TAJ Forms users, forms, reports, and platform settings." /></svelte:head>
{#if publicRoute}
  <slot />
{:else if status === 'ready'}
  <div class="admin-shell">
    <aside class="admin-sidebar"><a href="/forms/" class="admin-brand"><span class="brand-icon">T</span><span>TAJ <b>Forms</b><small>Platform console</small></span></a><div class="side-label">MANAGE</div><nav><a class:active={active === '/forms' || active === '/forms/'} href="/forms/">◈ <span>Overview</span></a><a class:active={active === '/forms/forms' || active.startsWith('/forms/forms/')} href="/forms/forms">▤ <span>Forms</span></a><a class:active={active.includes('/users')} href="/forms/users">♙ <span>Users</span></a><a class:active={active.includes('/reports')} href="/forms/reports">⚑ <span>Abuse reports</span></a><a class:active={active.includes('/audit')} href="/forms/audit">≋ <span>Audit log</span></a><a class:active={active.includes('/settings')} href="/forms/settings">⚙ <span>Settings</span></a></nav><div class="sidebar-bottom"><span class="admin-avatar">{adminName.slice(0,1).toUpperCase()}</span><span class="admin-identity"><b>{adminName}</b><small>Platform admin</small></span><button aria-label="Sign out" title="Sign out" onclick={signOut}>↗</button></div></aside>
    <div class="admin-main"><header class="admin-topbar"><div><span class="status-dot"></span> Control plane <span class="slash">/</span> {active.split('/').filter(Boolean).at(-1) || 'overview'}</div><a href="https://mdtaju.tech/forms/" target="_blank" rel="noreferrer">Open Forms ↗</a></header><slot /></div>
  </div>
{:else}
  <main class="admin-loading"><span class="spinner"></span><p>Verifying administrator session…</p></main>
{/if}
