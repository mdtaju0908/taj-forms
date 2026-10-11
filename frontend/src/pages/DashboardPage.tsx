import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, ClipboardList, Copy, ExternalLink, FilePlus2, LoaderCircle, MoreHorizontal, Pencil, Search, Send, Trash2 } from 'lucide-react'
import { api } from '../api'
import type { FormRecord } from '../types'

type Page<T> = { data: T[]; pagination: { page: number; limit: number; total: number; pages: number } }
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
const publicOrigin = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) || (import.meta.env.DEV ? `${window.location.origin}${basePath}` : 'https://mdtaju.tech/forms')

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [forms, setForms] = useState<FormRecord[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async (selectedPage = page) => {
    setLoading(true); setNotice('')
    try {
      const data = await api<Page<FormRecord>>(`/forms?page=${selectedPage}&limit=30&q=${encodeURIComponent(query)}${status ? `&status=${status}` : ''}`)
      setForms(data.data); setTotal(data.pagination.total); setPages(Math.max(1, data.pagination.pages))
    } catch (error: any) { setNotice(error.message || 'Could not load forms.') }
    finally { setLoading(false) }
  }, [page, query, status])
  useEffect(() => { void load(page) }, [load, page])
  const create = async () => {
    setBusyId('new'); setNotice('')
    try { const { data } = await api<{ data: FormRecord }>('/forms', { method: 'POST', body: JSON.stringify({ title: 'Untitled form' }) }); window.location.assign(`${basePath}/builder/${data._id}`) }
    catch (error: any) { setNotice(error.message || 'Could not create a form.') }
    finally { setBusyId('') }
  }
  const update = async (form: FormRecord, action: 'publish' | 'unpublish' | 'archive' | 'restore' | 'duplicate' | 'delete') => {
    if (action === 'delete' && !window.confirm(`Delete “${form.title}” and all its responses? This cannot be undone.`)) return
    if (action === 'archive' && !window.confirm(`Archive “${form.title}”? It will stop accepting public responses.`)) return
    setBusyId(`${form._id}-${action}`); setNotice('')
    try {
      if (action === 'duplicate') {
        const { data } = await api<{ data: FormRecord }>(`/forms/${form._id}/duplicate`, { method: 'POST', body: JSON.stringify({}) })
        window.location.assign(`${basePath}/builder/${data._id}`); return
      }
      if (action === 'delete') await api(`/forms/${form._id}`, { method: 'DELETE' })
      else if (action === 'publish') await api(`/forms/${form._id}/publish`, { method: 'POST', body: JSON.stringify({}) })
      else if (action === 'unpublish') await api(`/forms/${form._id}/unpublish`, { method: 'POST', body: JSON.stringify({}) })
      else await api(`/forms/${form._id}`, { method: 'PATCH', body: JSON.stringify({ status: action === 'restore' ? 'draft' : 'archived' }) })
      await load()
    } catch (error: any) { setNotice(error.message || 'That change could not be saved.') }
    finally { setBusyId('') }
  }
  const copyLink = async (form: FormRecord) => {
    try {
      await navigator.clipboard.writeText(`${publicOrigin}/f/${form.slug}`)
      setNotice(`Public link copied for “${form.title}”.`)
    } catch {
      setNotice('Could not copy the link. Open the public form and copy its address from the browser.')
    }
  }
  const createOnLoad = searchParams.get('create') === '1'
  useEffect(() => { if (createOnLoad && !loading && busyId !== 'new') { setSearchParams({}); void create() } }, [createOnLoad])

  return <main className="workspace-content">
    <div className="page-heading"><div><h1>Your forms</h1><p>Build a question flow, publish it, and keep every response in one place.</p></div><div className="heading-actions"><button className="button button-primary" onClick={() => void create()} disabled={busyId === 'new'}><FilePlus2 size={16}/> {busyId === 'new' ? 'Creating…' : 'Create form'}</button></div></div>
    {notice && <div className="form-error" role="status" style={{ marginBottom: 14 }}>{notice}</div>}
    <div className="toolbar"><label className="search-wrap"><Search size={16}/><input className="text-input" aria-label="Search forms" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder="Search your forms…"/></label><select className="select-input filter-select" aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">All forms</option><option value="draft">Drafts</option><option value="published">Published</option><option value="archived">Archived</option></select><span className="form-note">{total} {total === 1 ? 'form' : 'forms'}</span></div>
    {loading ? <div className="loading-state"><LoaderCircle className="spinner" style={{ margin: '0 auto 12px' }}/>Loading forms…</div> : forms.length === 0 ? <div className="empty-state"><ClipboardList size={30}/><h2>{query || status ? 'No matching forms' : 'Your first form starts here'}</h2><p>{query || status ? 'Try changing the search or status filter.' : 'Create a project intake, event feedback form, or a simple team check-in.'}</p>{!query && !status && <button className="button button-primary" onClick={() => void create()}><FilePlus2 size={16}/> Create a form</button>}</div> : <div className="forms-grid">{forms.map((form) => <article className="form-card" key={form._id}><div className="form-card-top"><div className="form-card-icon"><ClipboardList size={18}/></div><span className={`status-pill status-${form.status}`}>{form.status}</span></div><h2>{form.title}</h2><p>{form.description || 'No description yet.'}</p><div className="form-stats"><span>{form.fields?.length || 0} questions</span><span>{form.submissionCount || 0} responses</span></div><div className="form-card-actions">{form.status !== 'archived' && <Link className="button button-quiet button-small" to={`/builder/${form._id}`}><Pencil size={13}/> Edit</Link>}{form.status === 'published' ? <><button className="button button-quiet button-small" onClick={() => void copyLink(form)}><Copy size={13}/> Copy link</button><a className="button button-quiet button-small" href={`${publicOrigin}/f/${form.slug}`} target="_blank" rel="noreferrer" aria-label={`Open ${form.title} public form`}><ExternalLink size={13}/></a><Link className="button button-quiet button-small" to={`/responses/${form._id}`}>Responses</Link><button className="icon-button" onClick={() => void update(form, 'unpublish')} disabled={busyId.startsWith(form._id)} title="Unpublish" aria-label="Unpublish"><Archive size={14}/></button></> : form.status === 'archived' ? <button className="button button-primary button-small" onClick={() => void update(form, 'restore')} disabled={busyId.startsWith(form._id)}>Restore</button> : <button className="button button-primary button-small" onClick={() => void update(form, 'publish')} disabled={busyId.startsWith(form._id)}><Send size={13}/> Publish</button>}{form.status !== 'archived' && <button className="icon-button" onClick={() => void update(form, 'duplicate')} disabled={busyId.startsWith(form._id)} title="Duplicate" aria-label="Duplicate"><Copy size={14}/></button>}{form.status !== 'archived' && <button className="icon-button" onClick={() => void update(form, 'archive')} disabled={busyId.startsWith(form._id)} title="Archive" aria-label="Archive"><MoreHorizontal size={15}/></button>}<button className="icon-button" onClick={() => void update(form, 'delete')} disabled={busyId.startsWith(form._id)} title="Delete permanently" aria-label={`Delete ${form.title}`}><Trash2 size={14}/></button></div></article>)}</div>}
    {pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 22 }}><button className="button button-quiet button-small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="form-note" style={{ alignSelf: 'center' }}>Page {page} of {pages}</span><button className="button button-quiet button-small" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button></div>}
  </main>
}
