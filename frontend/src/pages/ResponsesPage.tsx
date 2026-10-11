import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, Download, Search } from 'lucide-react'
import { api, apiUrl } from '../api'
import { formatAnswer } from '../form-utils'
import type { FormField, FormRecord } from '../types'

type Submission = { _id: string; submittedAt: string; answers: Record<string, string | string[]> }
type Analytics = {
  totalSubmissions: number
  last30Days: { _id: string; count: number }[]
  fieldSummaries: { fieldId: string; label: string; answers: { value: string; count: number }[] }[]
  summarySampleSize: number
}
export function ResponsesPage() {
  const { formId = '' } = useParams()
  const [form, setForm] = useState<FormRecord | null>(null)
  const [rows, setRows] = useState<Submission[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [view, setView] = useState<'responses' | 'analytics'>('responses')
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsError, setAnalyticsError] = useState('')
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  useEffect(() => { setAnalytics(null); setAnalyticsError(''); setView('responses'); setSelected(null); setPage(1); setQuery('') }, [formId])
  useEffect(() => { let active = true; setLoading(true); setError(''); setSelected(null); Promise.all([api<{ data: FormRecord }>(`/forms/${formId}`), api<{ data: Submission[]; pagination: { pages: number } }>(`/forms/${formId}/submissions?page=${page}&limit=25&q=${encodeURIComponent(query)}`)]).then(([formData, responseData]) => { if (!active) return; setForm(formData.data); setRows(responseData.data); setPages(responseData.pagination.pages || 1) }).catch((reason: any) => { if (active) setError(reason.message || 'Could not load responses.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [formId, page, query])
  useEffect(() => { let active = true; let objectUrl = ''; setDownloadUrl(''); fetch(apiUrl(`/forms/${formId}/submissions.csv`), { credentials: 'include' }).then((response) => { if (!response.ok) throw new Error('Export unavailable'); return response.blob() }).then((blob) => { if (active) { objectUrl = URL.createObjectURL(blob); setDownloadUrl(objectUrl) } }).catch(() => { if (active) setDownloadUrl('') }); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) } }, [formId])
  useEffect(() => {
    if (view !== 'analytics' || analytics) return
    let active = true
    setAnalyticsLoading(true); setAnalyticsError('')
    api<{ data: Analytics }>(`/forms/${formId}/analytics`).then((result) => { if (active) setAnalytics(result.data) }).catch((reason: any) => { if (active) setAnalyticsError(reason.message || 'Could not load analytics.') }).finally(() => { if (active) setAnalyticsLoading(false) })
    return () => { active = false }
  }, [formId, view, analytics])
  const dailyCounts = (() => {
    const counts = new Map((analytics?.last30Days || []).map((day) => [day._id, day.count]))
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setUTCDate(date.getUTCDate() - (29 - index))
      const key = date.toISOString().slice(0, 10)
      return { key, count: counts.get(key) || 0, label: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date) }
    })
  })()
  const choiceSummaries = analytics?.fieldSummaries.filter((summary) => form?.fields.some((field) => field.id === summary.fieldId && ['dropdown', 'radio', 'checkbox', 'rating'].includes(field.type))) || []
  return <main className="workspace-content"><div className="page-heading"><div><Link to={`/builder/${formId}`} className="back-link"><ArrowLeft size={15}/> Back to builder</Link><h1>{form?.title || 'Form responses'}</h1><p>{view === 'responses' ? `${rows.length} response${rows.length === 1 ? '' : 's'} on this page` : 'Submission activity and answer summaries'}</p></div>{view === 'responses' && downloadUrl && <a className="button button-quiet" href={downloadUrl} download={`${form?.slug || 'form'}-responses.csv`}><Download size={16}/> Export CSV</a>}</div>
    <div className="response-tabs" role="tablist" aria-label="Form data views"><button role="tab" aria-selected={view === 'responses'} className={view === 'responses' ? 'active' : ''} onClick={() => setView('responses')}><Search size={15}/> Responses</button><button role="tab" aria-selected={view === 'analytics'} className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}><BarChart3 size={15}/> Analytics</button></div>
    {view === 'analytics' ? <section className="analytics-view" role="tabpanel">{analyticsError && <div className="form-error" role="alert">{analyticsError}</div>}{analyticsLoading && !analytics ? <div className="loading-state">Loading analytics…</div> : analytics && <><div className="analytics-summary"><article className="analytics-total"><span className="eyebrow">All time</span><strong>{analytics.totalSubmissions.toLocaleString()}</strong><span>Total submissions</span></article><article className="analytics-total"><span className="eyebrow">Last 30 days</span><strong>{dailyCounts.reduce((sum, day) => sum + day.count, 0).toLocaleString()}</strong><span>New submissions</span></article></div><section className="analytics-card"><div className="analytics-card-heading"><div><h2>Submission activity</h2><p>Daily submissions over the last 30 days</p></div><span className="analytics-legend"><i/> Submissions</span></div>{dailyCounts.every((day) => day.count === 0) ? <div className="analytics-empty">No submissions in the last 30 days.</div> : <div className="analytics-chart" role="img" aria-label={`${dailyCounts.reduce((sum, day) => sum + day.count, 0)} submissions over the last 30 days`}>{dailyCounts.map((day) => <div className="analytics-day" key={day.key} title={`${day.label}: ${day.count} submission${day.count === 1 ? '' : 's'}`}><span className="analytics-bar" style={{ height: `${Math.max(4, day.count / Math.max(...dailyCounts.map((item) => item.count)) * 100)}%` }}/></div>)}</div>}<div className="analytics-axis"><span>{dailyCounts[0]?.label}</span><span>{dailyCounts[14]?.label}</span><span>{dailyCounts[29]?.label}</span></div></section><div className="analytics-card-heading summary-heading"><div><h2>Answer summaries</h2><p>Choice responses from the latest {analytics.summarySampleSize.toLocaleString()} submissions</p></div></div>{choiceSummaries.length === 0 ? <div className="empty-state"><BarChart3 size={26}/><h2>No choice questions to summarize</h2><p>Add a dropdown, single choice, multiple choice, or rating question to see answer breakdowns here.</p></div> : <div className="analytics-fields">{choiceSummaries.map((summary) => { const max = Math.max(1, ...summary.answers.map((answer) => answer.count)); return <article className="analytics-card analytics-field" key={summary.fieldId}><h3>{summary.label}</h3>{summary.answers.length === 0 ? <p className="analytics-muted">No answers yet.</p> : summary.answers.map((answer) => <div className="answer-bar-row" key={answer.value}><div><span>{answer.value}</span><b>{answer.count}</b></div><i><span style={{ width: `${answer.count / max * 100}%` }}/></i></div>)}</article> })}</div>}</>}</section> : <>
    <div className="toolbar response-toolbar"><div className="search-wrap"><Search size={17}/><input className="text-input" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value) }} placeholder="Search answers" aria-label="Search answers"/></div></div>
    {error && <div className="form-error">{error}</div>}{loading ? <div className="loading-state">Loading responses…</div> : rows.length === 0 ? <div className="empty-state"><h2>No responses yet</h2><p>When someone submits your published form, the response will appear here.</p></div> : <><div className="table-wrap"><table className="response-table"><thead><tr><th>Submitted</th>{form?.fields.map((field) => <th key={field.id}>{field.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row._id} onClick={() => setSelected(row)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(row) }}><td>{new Date(row.submittedAt).toLocaleString()}</td>{form?.fields.map((field) => <td key={field.id}>{formatAnswer(field, row.answers?.[field.id])}</td>)}</tr>)}</tbody></table></div><div className="pagination-row"><span>Page {page} of {pages}</span><div><button className="button button-quiet button-small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button button-quiet button-small" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></>}
    {selected && <div className="detail-modal" role="dialog" aria-modal="true" aria-label="Response details" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="detail-card"><div className="page-heading"><div><span className="eyebrow">Response detail</span><h2>{new Date(selected.submittedAt).toLocaleString()}</h2></div><button className="button button-quiet" onClick={() => setSelected(null)}>Close</button></div>{form?.fields.map((field: FormField) => <dl className="detail-answer" key={field.id}><dt>{field.label}</dt><dd>{formatAnswer(field, selected.answers?.[field.id])}</dd></dl>)}</section></div>}
    </>}
  </main>
}
