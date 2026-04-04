'use client'

import { useEffect, useRef, useState } from 'react'

interface Question {
  id: string
  type: 'test' | 'video' | 'task'
  question_ru: string
  question_kz: string
  option_a_ru: string
  option_b_ru: string
  option_c_ru: string
  option_d_ru: string
  option_a_kz: string
  option_b_kz: string
  option_c_kz: string
  option_d_kz: string
  correct_option: string
  youtube_url_ru: string | null
  youtube_url_kz: string | null
  order_num: number
}

interface Olympiad { id: string; name_ru: string }

const TYPE_LABELS = { test: 'Тест', video: 'Видео', task: 'Задача' }
const TYPE_COLORS = { test: '#1ec8c8', video: '#f47920', task: '#e8206e' }
const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'

const emptyForm = {
  type: 'test' as 'test' | 'video' | 'task',
  question_ru: '', question_kz: '',
  option_a_ru: '', option_b_ru: '', option_c_ru: '', option_d_ru: '',
  option_a_kz: '', option_b_kz: '', option_c_kz: '', option_d_kz: '',
  correct_option: 'a', youtube_url_ru: '', youtube_url_kz: '', order_num: '1',
}

export default function QuestionsPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [selectedOlympiad, setSelectedOlympiad] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const formRef = useRef<HTMLDivElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/olympiads').then(r => r.json()).then(data => {
      setOlympiads(data)
      if (data.length > 0) setSelectedOlympiad(data[0].id)
    })
  }, [])

  async function loadQuestions(id: string) {
    const data = await fetch(`/api/admin/questions?olympiad_id=${id}`).then(r => r.json())
    setQuestions(data ?? [])
  }

  useEffect(() => { if (selectedOlympiad) loadQuestions(selectedOlympiad) }, [selectedOlympiad])

  function openAdd() {
    setEditingId(null)
    setForm({ ...emptyForm, order_num: String(questions.length + 1) })
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function openEdit(q: Question) {
    setEditingId(q.id)
    setForm({
      type: q.type,
      question_ru: q.question_ru,
      question_kz: q.question_kz,
      option_a_ru: q.option_a_ru,
      option_b_ru: q.option_b_ru,
      option_c_ru: q.option_c_ru,
      option_d_ru: q.option_d_ru,
      option_a_kz: q.option_a_kz,
      option_b_kz: q.option_b_kz,
      option_c_kz: q.option_c_kz,
      option_d_kz: q.option_d_kz,
      correct_option: q.correct_option,
      youtube_url_ru: q.youtube_url_ru ?? '',
      youtube_url_kz: q.youtube_url_kz ?? '',
      order_num: String(q.order_num),
    })
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
  }

  function buildPayload() {
    return {
      ...form,
      olympiad_id: selectedOlympiad,
      order_num: Number(form.order_num),
      youtube_url_ru: form.youtube_url_ru || null,
      youtube_url_kz: form.youtube_url_kz || null,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOlympiad) return alert('Выберите олимпиаду')
    setSaving(true)
    const url = editingId ? `/api/admin/questions?id=${editingId}` : '/api/admin/questions'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    })
    setSaving(false)
    if (res.ok) {
      closeForm()
      loadQuestions(selectedOlympiad)
    } else {
      const err = await res.json()
      alert('Ошибка: ' + err.error)
    }
  }

  async function handleCopyQuestion(q: Question) {
    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        olympiad_id: selectedOlympiad,
        type: q.type,
        question_ru: q.question_ru,
        question_kz: q.question_kz,
        option_a_ru: q.option_a_ru,
        option_b_ru: q.option_b_ru,
        option_c_ru: q.option_c_ru,
        option_d_ru: q.option_d_ru,
        option_a_kz: q.option_a_kz,
        option_b_kz: q.option_b_kz,
        option_c_kz: q.option_c_kz,
        option_d_kz: q.option_d_kz,
        correct_option: q.correct_option,
        youtube_url_ru: q.youtube_url_ru,
        youtube_url_kz: q.youtube_url_kz,
        order_num: questions.length + 1,
      }),
    })
    if (res.ok) loadQuestions(selectedOlympiad)
    else alert('Ошибка копирования')
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить вопрос?')) return
    await fetch(`/api/admin/questions?id=${id}`, { method: 'DELETE' })
    loadQuestions(selectedOlympiad)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!selectedOlympiad) { alert('Сначала выберите олимпиаду'); return }
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('olympiad_id', selectedOlympiad)
    const res = await fetch('/api/admin/questions/import', { method: 'POST', body: fd })
    setImporting(false)
    if (res.ok) {
      const data = await res.json()
      alert(`Импортировано: ${data.imported} вопросов`)
      loadQuestions(selectedOlympiad)
    } else {
      const err = await res.json()
      alert('Ошибка: ' + err.error)
    }
    if (importFileRef.current) importFileRef.current.value = ''
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-800">
          Вопросы <span className="font-mono text-base text-gray-400">({questions.length})</span>
        </h1>
        <div className="flex gap-2">
          <a href="/api/admin/questions/template" target="_blank"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]">
            ↓ Шаблон
          </a>
          <label className={`cursor-pointer rounded-xl border border-gray-200 px-3 py-2 text-sm ${importing ? 'text-gray-300' : 'text-gray-500 hover:border-[#f47920] hover:text-[#f47920]'}`}>
            {importing ? 'Импорт...' : '↑ Импорт Excel'}
            <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={openAdd}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}>
            + Добавить
          </button>
        </div>
      </div>

      <select value={selectedOlympiad} onChange={e => setSelectedOlympiad(e.target.value)}
        className="mb-4 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1ec8c8]">
        {olympiads.map(o => <option key={o.id} value={o.id}>{o.name_ru}</option>)}
      </select>

      {showForm && (
        <div ref={formRef}>
          <form onSubmit={handleSubmit} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-bold text-gray-800">
              {editingId ? 'Редактировать вопрос' : 'Новый вопрос'}
            </h3>

            <div className="mb-4 grid grid-cols-3 gap-2">
              {(['test', 'video', 'task'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(p => ({ ...p, type: t }))}
                  className="rounded-xl py-2 text-sm font-bold transition-all"
                  style={{
                    background: form.type === t ? TYPE_COLORS[t] + '18' : '#f9fafb',
                    color: form.type === t ? TYPE_COLORS[t] : '#6b7280',
                    border: `1px solid ${form.type === t ? TYPE_COLORS[t] + '66' : '#e5e7eb'}`,
                  }}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {form.type === 'video' && (
              <div className="mb-4 rounded-xl border border-orange-100 bg-orange-50 p-3">
                <p className="mb-2 text-xs font-bold text-orange-500">▶ YouTube ссылки (unlisted)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Русское видео</label>
                    <input type="url" value={form.youtube_url_ru}
                      onChange={e => setForm(p => ({ ...p, youtube_url_ru: e.target.value }))}
                      placeholder="https://youtu.be/..." className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Казахское видео</label>
                    <input type="url" value={form.youtube_url_kz}
                      onChange={e => setForm(p => ({ ...p, youtube_url_kz: e.target.value }))}
                      placeholder="https://youtu.be/..." className={inputCls} />
                  </div>
                </div>
              </div>
            )}

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Вопрос (рус)</label>
                <textarea value={form.question_ru} onChange={e => setForm(p => ({ ...p, question_ru: e.target.value }))}
                  required rows={2} className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Вопрос (каз)</label>
                <textarea value={form.question_kz} onChange={e => setForm(p => ({ ...p, question_kz: e.target.value }))}
                  required rows={2} className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]" />
              </div>
            </div>

            <p className="mb-2 text-xs font-semibold text-gray-500">Варианты ответов (рус)</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(['a','b','c','d'] as const).map(opt => (
                <div key={opt}>
                  <label className="mb-1 block text-xs text-gray-400">{opt.toUpperCase()}</label>
                  <input type="text" value={form[`option_${opt}_ru` as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [`option_${opt}_ru`]: e.target.value }))}
                    required className={inputCls} />
                </div>
              ))}
            </div>

            <p className="mb-2 text-xs font-semibold text-gray-500">Варианты ответов (каз)</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {(['a','b','c','d'] as const).map(opt => (
                <div key={opt}>
                  <label className="mb-1 block text-xs text-gray-400">{opt.toUpperCase()}</label>
                  <input type="text" value={form[`option_${opt}_kz` as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [`option_${opt}_kz`]: e.target.value }))}
                    required className={inputCls} />
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-gray-500">Правильный ответ</label>
              <div className="flex gap-2">
                {(['a','b','c','d'] as const).map(opt => (
                  <button key={opt} type="button" onClick={() => setForm(p => ({ ...p, correct_option: opt }))}
                    className="flex-1 rounded-xl py-2 text-sm font-bold transition-all"
                    style={{
                      background: form.correct_option === opt ? '#1ec8c818' : '#f9fafb',
                      color: form.correct_option === opt ? '#1ec8c8' : '#6b7280',
                      border: `1px solid ${form.correct_option === opt ? '#1ec8c866' : '#e5e7eb'}`,
                    }}>
                    {opt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-24">
                <label className="mb-1 block text-xs text-gray-500">Порядок</label>
                <input type="number" value={form.order_num}
                  onChange={e => setForm(p => ({ ...p, order_num: e.target.value }))}
                  className={inputCls} />
              </div>
              <div className="flex flex-1 justify-end gap-2 self-end">
                <button type="submit" disabled={saving}
                  className="rounded-xl px-5 py-2 text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}>
                  {saving ? 'Сохранение...' : editingId ? 'Сохранить' : 'Добавить'}
                </button>
                <button type="button" onClick={closeForm}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500">
                  Отмена
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {questions.map(q => (
          <div key={q.id} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <span className="w-8 font-mono text-xs text-gray-400">#{q.order_num}</span>
            <span className="rounded px-1.5 py-0.5 font-mono text-xs font-bold"
              style={{ background: TYPE_COLORS[q.type] + '18', color: TYPE_COLORS[q.type] }}>
              {TYPE_LABELS[q.type]}
            </span>
            <span className="flex-1 truncate text-sm text-gray-700">{q.question_ru}</span>
            {q.type === 'video' && (
              <span className="font-mono text-xs text-orange-400">
                {q.youtube_url_ru ? '▶RU' : '—'} {q.youtube_url_kz ? '▶KZ' : '—'}
              </span>
            )}
            <span className="font-mono text-xs text-[#1ec8c8]">✓ {q.correct_option.toUpperCase()}</span>
            <button onClick={() => openEdit(q)} title="Редактировать"
              className="text-xs text-gray-400 hover:text-[#1ec8c8]">✎</button>
            <button onClick={() => handleCopyQuestion(q)} title="Создать копию"
              className="text-xs text-gray-400 hover:text-[#f47920]">⎘</button>
            <button onClick={() => handleDelete(q.id)} title="Удалить"
              className="text-xs text-gray-300 hover:text-red-400">✕</button>
          </div>
        ))}
        {questions.length === 0 && <div className="py-12 text-center text-gray-400">Нет вопросов</div>}
      </div>
    </div>
  )
}
