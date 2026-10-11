import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, CheckCircle2, ExternalLink, LoaderCircle, Send } from 'lucide-react'
import { api } from '../api'
import { createFormAnswerSchema } from '../form-utils'
import type { Answer, FormField, FormRecord } from '../types'

type PublicForm = Pick<FormRecord, 'title' | 'description' | 'slug' | 'fields' | 'theme' | 'confirmationMessage'>

function Question({ field, value, onChange, error }: { field: FormField; value: Answer; onChange: (next: Answer) => void; error?: string }) {
  const name = `field-${field.id}`
  const labelId = `${name}-label`
  const common = { id: name, name, required: field.required, placeholder: field.placeholder || 'Your answer', 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${name}-error` : undefined }
  let input = null
  if (field.type === 'long_text') input = <textarea {...common} className="text-area" rows={4} maxLength={10000} value={String(value || '')} onChange={(event) => onChange(event.target.value)} />
  else if (field.type === 'dropdown') input = <select {...common} className="select-input" value={String(value || '')} onChange={(event) => onChange(event.target.value)}><option value="">{field.placeholder || 'Choose an option'}</option>{field.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
  else if (field.type === 'radio' || field.type === 'checkbox') input = <div className="option-list" role={field.type === 'radio' ? 'radiogroup' : 'group'} aria-labelledby={labelId} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}>{field.options.map((option, index) => <label key={option.id}><input id={index === 0 ? name : `${name}-${option.id}`} type={field.type === 'radio' ? 'radio' : 'checkbox'} name={field.type === 'radio' ? name : `${name}-${option.id}`} checked={field.type === 'radio' ? value === option.id : Array.isArray(value) && value.includes(option.id)} onChange={(event) => { if (field.type === 'radio') onChange(option.id); else { const current = Array.isArray(value) ? value : []; onChange(event.target.checked ? [...current, option.id] : current.filter((item) => item !== option.id)) } }} />{option.label}</label>)}</div>
  else if (field.type === 'rating') input = <div className="rating-list" role="radiogroup" aria-labelledby={labelId} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined}>{[1, 2, 3, 4, 5].map((rating) => <label key={rating}><input id={rating === 1 ? name : `${name}-${rating}`} type="radio" name={name} value={rating} checked={value === String(rating)} onChange={() => onChange(String(rating))} /><span>{rating}</span></label>)}</div>
  else input = <input {...common} className="text-input" type={field.type === 'short_text' ? 'text' : field.type} maxLength={field.type === 'number' || field.type === 'date' ? undefined : 2000} step={field.type === 'number' ? 'any' : undefined} value={String(value || '')} onChange={(event) => onChange(event.target.value)} />
  return <section className="public-question"><label id={labelId} htmlFor={name}>{field.label}{field.required && <span className="required-mark"> *</span>}</label>{field.description && <small>{field.description}</small>}{input}{error && <div id={`${name}-error`} className="error-text">{error}</div>}</section>
}

export function PublicFormPage() {
  const { slug = '' } = useParams()
  const [form, setForm] = useState<PublicForm | null>(null)
  const schema = useMemo(() => createFormAnswerSchema(form?.fields || []), [form?.fields])
  const resolver = useMemo(() => zodResolver(schema) as unknown as Resolver<Record<string, Answer>>, [schema])
  const { watch, register, setValue, clearErrors, reset, handleSubmit, formState: { errors } } = useForm<Record<string, Answer>>({ resolver, mode: 'onSubmit' })
  const answers = watch()
  const [state, setState] = useState<'loading' | 'ready' | 'sending' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [reportError, setReportError] = useState('')
  const style = useMemo(() => ({ '--public-accent': form?.theme?.accent || '#4f46e5', '--public-bg': form?.theme?.background || '#f7f8fc' }) as CSSProperties, [form])

  useEffect(() => {
    let active = true
    setForm(null); setState('loading'); setMessage('')
    api<{ data: PublicForm }>(`/public/forms/${encodeURIComponent(slug)}`).then(({ data }) => { if (active) { reset({ website: '' }); setForm(data); setState('ready') } }).catch((error) => { if (active) { setMessage(error.message || 'This form is unavailable.'); setState('error') } })
    return () => { active = false }
  }, [slug, reset])

  useEffect(() => { for (const field of form?.fields || []) register(field.id); register('website') }, [form?.fields, register])

  const submit = handleSubmit(async (values) => {
    if (!form) return
    setState('sending'); setMessage('')
    try { const website = String(values.website || ''); const cleanAnswers = Object.fromEntries(form.fields.map((field) => [field.id, values[field.id]])); await api(`/public/forms/${encodeURIComponent(slug)}/submissions`, { method: 'POST', body: JSON.stringify({ answers: cleanAnswers, website }) }); setState('success') }
    catch (error: any) { setMessage(error.message || 'Your response could not be submitted.'); setState('ready') }
  })

  const report = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setReportError('')
    const data = new FormData(event.currentTarget)
    try { const email = String(data.get('email') || '').trim(); await api(`/public/forms/${encodeURIComponent(slug)}/report`, { method: 'POST', body: JSON.stringify({ reason: data.get('reason'), details: data.get('details'), email: email || undefined, website: '' }) }); setReportSent(true) }
    catch (error: any) { setReportError(error.message || 'Could not send the report. Please try again.') }
  }

  if (state === 'loading') return <main className="public-form" style={style}><div className="public-form-card loading-state"><LoaderCircle className="spin"/> Loading form…</div></main>
  if (state === 'error') return <main className="public-form" style={style}><div className="public-form-card center-card"><AlertTriangle/><h1>Form unavailable</h1><p>{message}</p></div></main>
  return <main className="public-form" style={style}>
    <article className={`public-form-card ${form?.theme?.layout === 'compact' ? 'public-form-compact' : ''}`}>
      <div className="public-form-accent"/>
      {state === 'success' ? <div className="success-box"><CheckCircle2 size={42}/><h1>Response recorded</h1><p>{form?.confirmationMessage}</p></div> : <div className="public-form-inner">
        <div className="public-form-brand"><span className="brand-mark small-mark">T<span>.</span></span><span>TAJ Forms</span></div>
        <h1>{form?.title}</h1>{form?.description && <p>{form.description}</p>}
        <form onSubmit={(event) => void submit(event)} noValidate>
          {form?.fields.map((field) => <Question key={field.id} field={field} value={answers[field.id] || ''} error={String(errors[field.id]?.message || '')} onChange={(value) => { clearErrors(field.id); setValue(field.id, value, { shouldDirty: true, shouldValidate: true }) }} />)}
          {form?.fields.length === 0 && <div className="form-note">This form has no questions yet.</div>}
          {message && <div className="form-error" role="alert">{message}</div>}
          <input className="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" {...register('website')} />
          <button className="button button-primary" type="submit" disabled={state === 'sending' || !form?.fields.length}>{state === 'sending' ? <><LoaderCircle className="spin" size={16}/> Sending…</> : <>Submit response <Send size={15}/></>}</button>
        </form>
        <div className="report-row"><button type="button" className="report-button" onClick={() => { setReportOpen((open) => !open); setReportSent(false) }}>Report abuse</button></div>
        {reportOpen && <form className="report-form" onSubmit={(event) => void report(event)}>{reportSent ? <p className="success-note">Thank you. Your report has been received.</p> : <><label className="compact-label" htmlFor="report-reason">Reason</label><select id="report-reason" name="reason" className="select-input" required><option value="spam">Spam</option><option value="phishing">Phishing</option><option value="harassment">Harassment</option><option value="other">Other</option></select><label className="compact-label" htmlFor="report-details">Details (optional)</label><textarea id="report-details" name="details" className="text-area" rows={3} maxLength={1200}/><label className="compact-label" htmlFor="report-email">Email (optional)</label><input id="report-email" name="email" type="email" className="text-input" maxLength={254}/><button className="button button-quiet button-small" type="submit">Send report <ExternalLink size={14}/></button>{reportError && <div className="form-error">{reportError}</div>}</>}</form>}
      </div>}
    </article>
    <footer className="public-form-footer">Powered by <strong>TAJ Forms</strong></footer>
  </main>
}
