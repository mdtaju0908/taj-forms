import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Eye, GripVertical, Plus, Send, Trash2, Type, X, CalendarDays, Hash, Mail, ListChecks, Star, ImagePlus } from 'lucide-react'
import { api } from '../api'
import { prepareCoverImage } from '../image-utils'
import { fieldTypes, type FieldType, type FormField, type FormRecord } from '../types'

const id = () => globalThis.crypto?.randomUUID?.() || `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
const publicOrigin = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) || (import.meta.env.DEV ? `${window.location.origin}${basePath}` : 'https://mdtaju.tech/forms')
const createField = (type: FieldType): FormField => ({ id: id(), type, label: fieldTypes.find((item) => item.type === type)?.label || 'Question', description: '', placeholder: '', required: false, options: ['dropdown', 'radio', 'checkbox'].includes(type) ? [{ id: id(), label: 'Option 1' }, { id: id(), label: 'Option 2' }] : [] })
const optionIcon = (type: FieldType) => type === 'email' ? <Mail size={16}/> : type === 'number' ? <Hash size={16}/> : ['dropdown', 'radio', 'checkbox'].includes(type) ? <ListChecks size={16}/> : type === 'date' ? <CalendarDays size={16}/> : type === 'rating' ? <Star size={16}/> : <Type size={16}/>

function PreviewAnswer({ field }: { field: FormField }) {
  const placeholder = field.placeholder || 'Your answer'
  if (field.type === 'long_text') return <textarea className="text-area" rows={3} placeholder={placeholder} disabled aria-label={`${field.label} preview`} />
  if (field.type === 'dropdown') return <select className="select-input" disabled aria-label={`${field.label} preview`}><option>{field.placeholder || 'Choose an option'}</option>{field.options.map((option) => <option key={option.id}>{option.label}</option>)}</select>
  if (field.type === 'radio' || field.type === 'checkbox') return <div className="option-list preview-option-list">{field.options.map((option) => <label key={option.id}><input type={field.type} disabled />{option.label}</label>)}</div>
  if (field.type === 'rating') return <div className="rating-list preview-rating-list" aria-label={`${field.label} preview`}>{[1, 2, 3, 4, 5].map((rating) => <span key={rating}>{rating}</span>)}</div>
  return <input className="text-input" type={field.type === 'short_text' ? 'text' : field.type} placeholder={placeholder} disabled aria-label={`${field.label} preview`} />
}

function SortableQuestion({ field, selected, onSelect, onDuplicate, onDelete, onMove }: { field: FormField; selected: boolean; onSelect: () => void; onDuplicate: () => void; onDelete: () => void; onMove: (direction: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .55 : 1 }
  return <article ref={setNodeRef} style={style} className={`builder-question ${selected ? 'selected' : ''}`} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect() }} aria-label={`Edit question ${field.label}`}>
    <div className="question-actions"><button type="button" onClick={(e) => { e.stopPropagation(); onMove(-1) }} aria-label="Move question up"><ChevronUp size={15}/></button><button type="button" onClick={(e) => { e.stopPropagation(); onMove(1) }} aria-label="Move question down"><ChevronDown size={15}/></button><button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate() }} aria-label="Duplicate question"><CopyIcon/></button><button type="button" onClick={(e) => { e.stopPropagation(); onDelete() }} aria-label="Delete question"><Trash2 size={14}/></button></div>
    <div className="question-top"><button type="button" className="drag-handle icon-button" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} aria-label="Drag to reorder"><GripVertical size={17}/></button><span className="question-title">{field.label}{field.required && <span className="required-mark"> *</span>}</span><span className="question-type">{fieldTypes.find((item) => item.type === field.type)?.label}</span></div>
    <div className="question-preview">{field.placeholder || field.description || 'Visitor response will appear here'}</div>
  </article>
}
function CopyIcon() { return <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>⧉</span> }

export function BuilderPage() {
  const { formId = '' } = useParams()
  const [form, setForm] = useState<FormRecord | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [notice, setNotice] = useState('')
  const [copyNotice, setCopyNotice] = useState('')
  const [coverBusy, setCoverBusy] = useState(false)
  const coverInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState(false)
  const lastSavedRef = useRef('')
  const saveQueue = useRef(Promise.resolve())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const serialized = useMemo(() => form ? JSON.stringify({ title: form.title, description: form.description, coverImage: form.coverImage || '', fields: form.fields, theme: form.theme, confirmationMessage: form.confirmationMessage }) : '', [form])

  useEffect(() => {
    let live = true
    setLoaded(false); setForm(null); setNotice(''); setCopyNotice('')
    api<{ data: FormRecord }>(`/forms/${formId}`).then(({ data }) => {
      if (!live) return
      const normalized = { ...data, coverImage: data.coverImage || '', fields: Array.isArray(data.fields) ? data.fields : [], theme: data.theme || { accent: '#4f46e5', background: '#f7f8fc', layout: 'classic' } }
      setForm(normalized); setSelectedId(normalized.fields[0]?.id || ''); lastSavedRef.current = JSON.stringify({ title: normalized.title, description: normalized.description, coverImage: normalized.coverImage, fields: normalized.fields, theme: normalized.theme, confirmationMessage: normalized.confirmationMessage }); if (normalized.status === 'published') setNotice('Published. Your share link is ready.'); setLoaded(true)
    }).catch((error: any) => { setNotice(error.message || 'Could not load this form.'); setLoaded(true) })
    return () => { live = false }
  }, [formId])

  const saveSnapshot = useCallback((snapshot: NonNullable<typeof form>, encoded: string) => {
    setSaveState('saving')
    saveQueue.current = saveQueue.current.then(async () => {
      await api(`/forms/${formId}`, { method: 'PATCH', body: JSON.stringify({ title: snapshot.title, description: snapshot.description, coverImage: snapshot.coverImage || '', fields: snapshot.fields, definitionVersion: 1, theme: snapshot.theme, confirmationMessage: snapshot.confirmationMessage }) })
      lastSavedRef.current = encoded
      setSaveState('saved')
      setNotice((current) => current.startsWith('Autosave failed:') ? '' : current)
    }).catch((error: any) => { console.error('[TAJ Forms] Autosave failed', error); setSaveState('error'); setNotice(`Autosave failed: ${error.message || 'Please retry saving.'}`) })
  }, [formId])

  useEffect(() => {
    if (!loaded || !form || serialized === lastSavedRef.current) return
    setSaveState('saving')
    const timer = window.setTimeout(() => saveSnapshot(form, serialized), 700)
    return () => window.clearTimeout(timer)
  }, [loaded, form, serialized, saveSnapshot])

  const selected = form?.fields.find((field) => field.id === selectedId) || null
  const addField = (type: FieldType) => {
    if (!form) return
    if (form.fields.length >= 50) { setNotice('A form can have up to 50 questions.'); return }
    const field = createField(type)
    setForm({ ...form, fields: [...form.fields, field] }); setSelectedId(field.id); setNotice('')
  }
  const editField = (patch: Partial<FormField>) => {
    if (!form || !selected) return
    setForm({ ...form, fields: form.fields.map((field) => field.id === selected.id ? { ...field, ...patch } : field) })
  }
  const moveField = (fieldId: string, direction: number) => {
    if (!form) return
    const from = form.fields.findIndex((field) => field.id === fieldId)
    const to = from + direction
    if (from < 0 || to < 0 || to >= form.fields.length) return
    const fields = [...form.fields]; [fields[from], fields[to]] = [fields[to], fields[from]]
    setForm({ ...form, fields })
  }
  const duplicateField = (fieldId: string) => {
    if (!form || form.fields.length >= 50) return
    const index = form.fields.findIndex((field) => field.id === fieldId)
    const original = form.fields[index]
    if (!original) return
    const clone = { ...structuredClone(original), id: id(), label: `${original.label} copy`.slice(0, 120), options: original.options.map((option) => ({ ...option, id: id() })) }
    const fields = [...form.fields]; fields.splice(index + 1, 0, clone); setForm({ ...form, fields }); setSelectedId(clone.id)
  }
  const deleteField = (fieldId: string) => {
    if (!form) return
    const fields = form.fields.filter((field) => field.id !== fieldId)
    setForm({ ...form, fields }); if (selectedId === fieldId) setSelectedId(fields[0]?.id || '')
  }
  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setCoverBusy(true); setNotice('')
    try {
      const coverImage = await prepareCoverImage(file)
      setForm((current) => current ? { ...current, coverImage } : current)
    } catch (error: any) {
      setNotice(error.message || 'Could not process this cover image.')
    } finally {
      setCoverBusy(false)
      input.value = ''
    }
  }
  const dragEnd = (event: DragEndEvent) => {
    if (!form || !event.over || event.active.id === event.over.id) return
    const from = form.fields.findIndex((field) => field.id === event.active.id)
    const to = form.fields.findIndex((field) => field.id === event.over?.id)
    if (from >= 0 && to >= 0) setForm({ ...form, fields: arrayMove(form.fields, from, to) })
  }
  const publish = async () => {
    if (!form) return
    const invalidField = form.fields.find((field) => !field.label.trim() || (['dropdown', 'radio', 'checkbox'].includes(field.type) && (field.options.length === 0 || field.options.some((option) => !option.label.trim()))))
    if (invalidField) {
      setSelectedId(invalidField.id)
      setNotice(!invalidField.label.trim() ? 'Add a question label before publishing.' : 'Choice questions need at least one option, and each option needs a label.')
      return
    }
    await saveQueue.current
    try {
      if (serialized !== lastSavedRef.current) await api(`/forms/${formId}`, { method: 'PATCH', body: JSON.stringify({ title: form.title, description: form.description, coverImage: form.coverImage || '', fields: form.fields, theme: form.theme, confirmationMessage: form.confirmationMessage, definitionVersion: 1 }) })
      const { data } = await api<{ data: FormRecord }>(`/forms/${formId}/publish`, { method: 'POST', body: JSON.stringify({}) })
      setForm(data); lastSavedRef.current = JSON.stringify({ title: data.title, description: data.description, coverImage: data.coverImage || '', fields: data.fields, theme: data.theme, confirmationMessage: data.confirmationMessage }); setSaveState('saved'); setNotice('Published. Your share link is ready.')
    } catch (error: any) { setNotice(error.message || 'Could not publish this form.') }
  }
  const copyShareLink = async () => {
    if (!form) return
    try { await navigator.clipboard.writeText(`${publicOrigin}/f/${form.slug}`); setCopyNotice('Link copied.') }
    catch { setCopyNotice('Copy failed. Open the form and copy its address from the browser.') }
  }
  if (!loaded) return <main className="workspace-content"><div className="loading-state">Loading form editor…</div></main>
  if (!form) return <main className="workspace-content"><div className="form-error">{notice || 'Form not found.'}</div><Link className="button button-quiet" to="/dashboard">Back to forms</Link></main>
  return <div className="builder-page">
    <header className="builder-toolbar"><Link to="/dashboard" className="button button-quiet button-small"><ArrowLeft size={14}/> Forms</Link><div className="builder-title">{form.title || 'Untitled form'} <span className={`status-pill status-${form.status}`}>{form.status}</span></div><div className="builder-actions"><span className="save-state" aria-live="polite">{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : <><Check size={12}/> Saved</>}</span>{saveState === 'error' && <button className="button button-quiet button-small" onClick={() => saveSnapshot(form, serialized)}>Retry save</button>}<button className="button button-quiet button-small" onClick={() => setPreview((value) => !value)}><Eye size={14}/>{preview ? 'Edit form' : 'Preview'}</button><button className="button button-primary button-small" onClick={() => void publish()} disabled={!form.title.trim() || form.fields.length === 0}>Publish form <Send size={14}/></button></div></header>
    {notice && <div className={`builder-notice ${notice.startsWith('Published.') ? 'success' : 'error'}`} role="status">{notice}{notice.startsWith('Published.') && <span className="builder-share-actions"><button className="button button-quiet button-small" onClick={() => void copyShareLink()}><Copy size={13}/> Copy link</button><a className="button button-quiet button-small" href={`${publicOrigin}/f/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Open form</a>{copyNotice && <span>{copyNotice}</span>}</span>}</div>}
    {preview ? <div className="public-form" style={{ ['--public-bg' as any]: form.theme.background, ['--public-accent' as any]: form.theme.accent }}><div className={`public-form-card ${form.theme.layout === 'compact' ? 'public-form-compact' : ''}`}>{form.coverImage && <img className="public-form-cover" src={form.coverImage} alt=""/>}<div className="public-form-accent"/><div className="public-form-inner"><div className="public-form-brand"><span className="brand-mark small-mark">T<span>.</span></span><span>TAJ Forms</span></div><h1>{form.title || 'Untitled form'}</h1>{form.description && <p>{form.description}</p>}{form.fields.map((field) => <section className="public-question" key={field.id}><label>{field.label}{field.required && <span className="required-mark"> *</span>}</label>{field.description && <small>{field.description}</small>}<PreviewAnswer field={field}/></section>)}<button className="button button-primary" type="button" disabled>Submit response <Send size={15}/></button></div></div><footer className="public-form-footer">Powered by <strong>TAJ Forms</strong></footer></div> : <div className="builder-grid">
      <aside className="builder-sidebar"><h2>Question type</h2>{fieldTypes.map((item) => <button className="type-button" key={item.type} onClick={() => addField(item.type)}>{optionIcon(item.type)}<span>{item.label}<small>{item.help}</small></span><Plus size={14}/></button>)}<p className="form-note" style={{ padding: '10px 4px' }}>Drag questions to reorder. Keyboard users can use the up/down controls on each question.</p></aside>
      <section className="builder-canvas" aria-label="Form questions"><div className="canvas-form"><div className="builder-intro" style={{ borderTopColor: form.theme.accent }}>{form.coverImage && <div className="cover-preview-wrap"><img className="builder-cover-preview" src={form.coverImage} alt="Cover preview"/><button type="button" className="button button-quiet button-small cover-remove" onClick={() => setForm({ ...form, coverImage: '' })}>Remove cover</button></div>}<label className="compact-label" htmlFor="form-title">Form title</label><input id="form-title" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Give your form a clear title"/><label className="compact-label" htmlFor="form-description">Description</label><textarea id="form-description" maxLength={600} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this form for?"/><div className="cover-upload-row"><input ref={coverInput} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadCover(event)}/><button type="button" className="button button-quiet button-small" onClick={() => coverInput.current?.click()} disabled={coverBusy}><ImagePlus size={14}/>{coverBusy ? 'Preparing image…' : form.coverImage ? 'Change cover image' : 'Add cover image'}</button><span className="form-note">PNG, JPEG, or WebP · up to 8 MB (resized automatically)</span></div><div className="form-theme-controls"><label className="form-note">Accent <input aria-label="Accent color" type="color" value={form.theme.accent} onChange={(e) => setForm({ ...form, theme: { ...form.theme, accent: e.target.value } })}/></label><label className="form-note">Background <input aria-label="Background color" type="color" value={form.theme.background} onChange={(e) => setForm({ ...form, theme: { ...form.theme, background: e.target.value } })}/></label><label className="form-note layout-select-label">Layout <select className="select-input" value={form.theme.layout} onChange={(e) => setForm({ ...form, theme: { ...form.theme, layout: e.target.value as 'classic' | 'compact' } })}><option value="classic">Classic</option><option value="compact">Compact</option></select></label></div></div>
        {form.fields.length === 0 && <div className="empty-state"><Plus size={24}/><h2>Add your first question</h2><p>Pick a type in the left panel. Your form saves as you work.</p></div>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={form.fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>{form.fields.map((field) => <SortableQuestion key={field.id} field={field} selected={selectedId === field.id} onSelect={() => setSelectedId(field.id)} onDuplicate={() => duplicateField(field.id)} onDelete={() => deleteField(field.id)} onMove={(direction) => moveField(field.id, direction)}/>)}</SortableContext></DndContext>
        <button className="button button-quiet full-width" onClick={() => addField('short_text')}><Plus size={16}/> Add a question</button>
      </div></section>
      <aside className="settings-panel"><h2>{selected ? 'Question settings' : 'Form settings'}</h2>{selected ? <>
        <div className="settings-group"><label className="compact-label" htmlFor={`question-text-${selected.id}`}>Question text</label><input id={`question-text-${selected.id}`} className="compact-input" maxLength={120} value={selected.label} onChange={(e) => editField({ label: e.target.value })}/><label className="compact-label" htmlFor={`question-help-${selected.id}`}>Helper text</label><input id={`question-help-${selected.id}`} className="compact-input" maxLength={300} value={selected.description} onChange={(e) => editField({ description: e.target.value })}/><label className="compact-label" htmlFor={`question-placeholder-${selected.id}`}>Placeholder</label><input id={`question-placeholder-${selected.id}`} className="compact-input" maxLength={160} value={selected.placeholder} onChange={(e) => editField({ placeholder: e.target.value })}/><label className="switch-row"><span>Required question</span><input type="checkbox" checked={selected.required} onChange={(e) => editField({ required: e.target.checked })}/></label></div>
        {['dropdown', 'radio', 'checkbox'].includes(selected.type) && <div className="settings-group"><span className="compact-label">Answer options</span>{selected.options.map((option, index) => <div className="option-edit" key={option.id}><input className="compact-input" aria-label={`Option ${index + 1}`} maxLength={100} value={option.label} onChange={(e) => editField({ options: selected.options.map((item, i) => i === index ? { ...item, label: e.target.value } : item) })}/><button className="icon-button" aria-label={`Remove option ${index + 1}`} disabled={selected.options.length <= 1} title={selected.options.length <= 1 ? 'Keep at least one option' : 'Remove option'} onClick={() => editField({ options: selected.options.filter((item) => item.id !== option.id) })}><X size={14}/></button></div>)}<button className="button button-quiet button-small" disabled={selected.options.length >= 30} onClick={() => editField({ options: [...selected.options, { id: id(), label: `Option ${selected.options.length + 1}` }] })}><Plus size={13}/> Add option</button><p className="form-note">Add up to 30 choices. Each option needs a label.</p></div>}
        <button className="button button-danger button-small" onClick={() => deleteField(selected.id)}><Trash2 size={14}/> Delete question</button>
      </> : <><div className="form-note">Edit the form title, description, cover image, and appearance in the form card.</div><div className="settings-group"><label className="compact-label" htmlFor="confirmation">Confirmation after submit</label><textarea id="confirmation" maxLength={500} rows={4} className="text-area" value={form.confirmationMessage} onChange={(e) => setForm({ ...form, confirmationMessage: e.target.value })}/><p className="form-note">Shown after a visitor submits the form.</p></div></>}</aside>
    </div>}
  </div>
}
