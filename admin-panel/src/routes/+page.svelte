<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  let data: any = null
  let error = ''
  onMount(() => { api<{ data: any }>('/admin/overview').then((result) => data = result.data).catch((reason) => error = reason.message) })
  const cards = [ ['Total users', 'users', '↗'], ['Published forms', 'publishedForms', '▤'], ['Submissions', 'submissions', '↙'], ['Open reports', 'openReports', '⚑'] ]
</script>

<main class="admin-content"><div class="page-title"><div><span class="kicker">TAJ FORMS / PLATFORM</span><h1>Overview</h1><p>Service health and activity at a glance.</p></div><span class="live-badge" class:warning={data && data.database !== 'connected'}><i></i> {data?.database === 'connected' ? 'Operations normal' : data?.database === 'disconnected' ? 'Database unavailable' : 'Checking status'}</span></div>
  {#if error}<div class="notice error">{error}</div>{/if}
  <div class="stat-grid">{#each cards as card}<article class="stat-card"><div class="stat-label">{card[0]} <span>{card[2]}</span></div><strong>{data?.[card[1]] ?? '—'}</strong><small>Current platform total</small></article>{/each}</div>
  <section class="panel health-panel"><div><span class="panel-icon">◉</span><div><h2>System status</h2><p>Database connection and process uptime.</p></div></div><span class:healthy={data?.database === 'connected'} class="health-status">{data?.database || 'Checking'}</span><div class="health-meta"><span>API uptime <b>{data?.uptimeSeconds ? `${Math.floor(data.uptimeSeconds / 3600)}h ${Math.floor(data.uptimeSeconds % 3600 / 60)}m` : '—'}</b></span><span>Active accounts <b>{data?.activeUsers ?? '—'}</b></span><span>Total forms <b>{data?.forms ?? '—'}</b></span></div></section>
</main>
