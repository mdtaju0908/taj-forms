<script lang="ts">
  import { goto } from '$app/navigation'
  import { api, setCsrfToken } from '$lib/api'
  let email = ''; let password = ''; let error = ''; let loading = false
  async function submit(event: SubmitEvent) { event.preventDefault(); error = ''; loading = true; try { const result = await api<{ user: { role: string }; csrfToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setCsrfToken(result.csrfToken); if (result.user.role !== 'admin') { error = 'This account does not have administrator access.'; await api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined); setCsrfToken(''); return } await goto('/forms/') } catch (reason: any) { error = reason.message || 'Could not sign in.' } finally { loading = false } }
</script>

<svelte:head><title>Admin sign in · TAJ Forms</title></svelte:head>
<main class="login-shell"><section class="login-card"><a href="/forms/" class="admin-brand"><span class="brand-icon">T</span><span>TAJ <b>Forms</b><small>Platform console</small></span></a><span class="kicker">RESTRICTED ACCESS</span><h1>Admin sign in</h1><p>Use the administrator account provisioned for this platform.</p><form onsubmit={submit}><label>Email<input type="email" bind:value={email} autocomplete="username" required /></label><label>Password<input type="password" bind:value={password} autocomplete="current-password" required /></label>{#if error}<div class="notice error">{error}</div>{/if}<button class="primary-button" disabled={loading}>{loading ? 'Checking…' : 'Continue securely'} <span>→</span></button></form><small class="login-footnote">Access is logged and restricted to authorized administrators.</small></section></main>
