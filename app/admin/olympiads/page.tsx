'use client'

import { useEffect, useState } from 'react'

interface Subject { name_ru: string; name_kz: string; from_q: number; to_q: number }
type SubjectRow = { name_ru: string; name_kz: string; from_q: string; to_q: string }

interface Olympiad {
  id: string
  name_ru: string
  name_kz: string
  subject: string | null
  start_time: string | null
  duration_minutes: number
  status: 'draft' | 'registration' | 'active' | 'finished'
  intro_video_url: string | null
  intro_text_ru: string | null
  intro_text_kz: string | null
  outro_video_url: string | null
  cert_range_winner_min: number
  cert_range_prize_min: number
  cert_range_pass_min: number
  subjects: Subject[] | null
}

function toLocalString(utcTime: string) {
  return new Date(utcTime).toLocaleString('ru', { timeZone: 'Asia/Qyzylorda' })
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', registration: 'Регистрация', active: 'Активна', finished: 'Завершена',
}
const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', registration: '#f47920', active: '#1ec8c8', finished: '#9ca3af',
}
const ALL_STATUSES = ['draft', 'registration', 'active', 'finished'] as const

const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'
const textareaCls = 'w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'

type FormData = {
  name_ru: string; name_kz: string; subject: string
  start_time: string; duration_minutes: string
  intro_video_url: string; intro_text_ru: string; intro_text_kz: string
  outro_video_url: string
  cert_range_winner_min: string; cert_range_prize_min: string; cert_range_pass_min: string
}

const emptyForm: FormData = {
  name_ru: '', name_kz: '', subject: '', start_time: '', duration_minutes: '60',
  intro_video_url: '', intro_text_ru: '', intro_text_kz: '',
  outro_video_url: '',
  cert_range_winner_min: '90', cert_range_prize_min: '75', cert_range_pass_min: '50',
}

function toFormData(o: Olympiad): FormData {
  return {
    name_ru: o.name_ru,
    name_kz: o.name_kz,
    subject: o.subject ?? '',
    start_time: o.start_time ? new Date(o.start_time).toISOString().slice(0, 16) : '',
    duration_minutes: String(o.duration_minutes),
    intro_video_url: o.intro_video_url ?? '',
    intro_text_ru: o.intro_text_ru ?? '',
    intro_text_kz: o.intro_text_kz ?? '',
    outro_video_url: o.outro_video_url ?? '',
    cert_range_winner_min: String(o.cert_range_winner_min),
    cert_range_prize_min: String(o.cert_range_prize_min),
    cert_range_pass_min: String(o.cert_range_pass_min),
  }
}

export default function OlympiadsPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/olympiads')
    if (res.ok) setOlympiads(await res.json())
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setSubjects([])
    setShowForm(true)
  }

  function openEdit(o: Olympiad) {
    setEditingId(o.id)
    setForm(toFormData(o))
    setSubjects((o.subjects ?? []).map(s => ({ ...s, from_q: String(s.from_q), to_q: String(s.to_q) })))
    setShowForm(true)
  }

  function buildBody(f: FormData) {
    return {
      name_ru: f.name_ru.trim(),
      name_kz: f.name_kz.trim(),
      subject: f.subject.trim() || null,
      start_time: f.start_time
        ? new Date(f.start_time + ':00+05:00').toISOString()
        : null,
      duration_minutes: Number(f.duration_minutes),
      intro_video_url: f.intro_video_url.trim() || null,
      intro_text_ru: f.intro_text_ru.trim() || null,
      intro_text_kz: f.intro_text_kz.trim() || null,
      outro_video_url: f.outro_video_url.trim() || null,
      cert_range_winner_min: Number(f.cert_range_winner_min),
      cert_range_prize_min: Number(f.cert_range_prize_min),
      cert_range_pass_min: Number(f.cert_range_pass_min),
      subjects: subjects.filter(s => s.name_ru.trim()).map(s => ({
        name_ru: s.name_ru.trim(),
        name_kz: s.name_kz.trim(),
        from_q: Number(s.from_q) || 1,
        to_q: Number(s.to_q) || 1,
      })),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = buildBody(form)
    const url = editingId ? `/api/admin/olympiads?id=${editingId}` : '/api/admin/olympiads'
    const method = editingId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      load()
    } else {
      const err = await res.json()
      alert('Ошибка: ' + err.error)
    }
  }

  async function setStatus(o: Olympiad, status: string) {
    await fetch(`/api/admin/olympiads?id=${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  async function handleCopy(o: Olympiad) {
    if (!confirm(`Создать копию олимпиады «${o.name_ru}»? Скопируются все вопросы.`)) return
    const res = await fetch(`/api/admin/olympiads/copy?id=${o.id}`, { method: 'POST' })
    if (res.ok) {
      load()
    } else {
      const err = await res.json()
      alert('Ошибка: ' + err.error)
    }
  }

  async function handleDelete(o: Olympiad) {
    if (!confirm(`Удалить олимпиаду «${o.name_ru}»? Все данные (вопросы, результаты) будут удалены.`)) return
    await fetch(`/api/admin/olympiads?id=${o.id}`, { method: 'DELETE' })
    load()
  }

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-800">Олимпиады</h1>
        <button onClick={openCreate}
          className="rounded-xl px-4 py-2.5 text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}>
          + Создать
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit}
          className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-bold text-[#1ec8c8]">
            {editingId ? 'Редактировать олимпиаду' : 'Новая олимпиада'}
          </h2>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'name_ru', label: 'Название (рус)', required: true },
              { key: 'name_kz', label: 'Название (каз)', required: true },
              { key: 'subject', label: 'Предмет' },
              { key: 'start_time', label: 'Время старта', type: 'datetime-local' },
              { key: 'duration_minutes', label: 'Длительность (мин)', type: 'number' },
            ] as const).map(f => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-500">{f.label}</label>
                <input type={(f as { type?: string }).type ?? 'text'}
                  value={form[f.key]}
                  onChange={set(f.key)}
                  required={(f as { required?: boolean }).required}
                  className={inputCls} />
              </div>
            ))}
          </div>

          {/* Cert ranges */}
          <div className="mt-3">
            <p className="mb-2 text-xs text-gray-500">Диапазоны сертификатов (% от общего числа вопросов)</p>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'cert_range_winner_min', label: 'Победитель ≥' },
                { key: 'cert_range_prize_min', label: 'Призёр ≥' },
                { key: 'cert_range_pass_min', label: 'Участник ≥' },
              ] as const).map(f => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs text-gray-500">{f.label}</label>
                  <input type="number" value={form[f.key]} onChange={set(f.key)} className={inputCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Intro video */}
          <div className="mt-3">
            <label className="mb-1 block text-xs text-gray-500">YouTube ссылка (вводное видео — перед стартом)</label>
            <input type="url" value={form.intro_video_url} onChange={set('intro_video_url')}
              placeholder="https://youtu.be/..." className={inputCls} />
          </div>

          {/* Outro video */}
          <div className="mt-3">
            <label className="mb-1 block text-xs text-gray-500">YouTube ссылка (финальное видео — после завершения)</label>
            <input type="url" value={form.outro_video_url} onChange={set('outro_video_url')}
              placeholder="https://youtu.be/..." className={inputCls} />
          </div>

          {/* Subjects */}
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-600">Предметы</p>
              <button type="button"
                onClick={() => setSubjects(p => [...p, { name_ru: '', name_kz: '', from_q: '', to_q: '' }])}
                className="rounded-lg border border-[#1ec8c8] px-2.5 py-1 text-xs text-[#1ec8c8] hover:bg-[#1ec8c8] hover:text-white">
                + Добавить предмет
              </button>
            </div>
            {subjects.length === 0 && (
              <p className="text-xs text-gray-400">Предметы не добавлены. Без предметов результаты показываются общим баллом.</p>
            )}
            {subjects.map((s, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_72px_72px_32px] items-end gap-2">
                <div>
                  {i === 0 && <label className="mb-1 block text-xs text-gray-400">Название (рус)</label>}
                  <input value={s.name_ru} placeholder="Математика"
                    onChange={e => setSubjects(p => p.map((r, j) => j === i ? { ...r, name_ru: e.target.value } : r))}
                    className={inputCls} />
                </div>
                <div>
                  {i === 0 && <label className="mb-1 block text-xs text-gray-400">Название (каз)</label>}
                  <input value={s.name_kz} placeholder="Математика"
                    onChange={e => setSubjects(p => p.map((r, j) => j === i ? { ...r, name_kz: e.target.value } : r))}
                    className={inputCls} />
                </div>
                <div>
                  {i === 0 && <label className="mb-1 block text-xs text-gray-400">Вопрос с</label>}
                  <input type="number" min="1" value={s.from_q} placeholder="1"
                    onChange={e => setSubjects(p => p.map((r, j) => j === i ? { ...r, from_q: e.target.value } : r))}
                    className={inputCls} />
                </div>
                <div>
                  {i === 0 && <label className="mb-1 block text-xs text-gray-400">по №</label>}
                  <input type="number" min="1" value={s.to_q} placeholder="10"
                    onChange={e => setSubjects(p => p.map((r, j) => j === i ? { ...r, to_q: e.target.value } : r))}
                    className={inputCls} />
                </div>
                <button type="button"
                  onClick={() => setSubjects(p => p.filter((_, j) => j !== i))}
                  className="rounded-lg border border-gray-200 px-2 py-2.5 text-xs text-gray-300 hover:border-red-300 hover:text-red-400">
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Intro text */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Вступительный текст / правила (рус)</label>
              <textarea rows={4} value={form.intro_text_ru} onChange={set('intro_text_ru')}
                placeholder="Правила олимпиады..." className={textareaCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Кіріспе мәтін / ережелер (каз)</label>
              <textarea rows={4} value={form.intro_text_kz} onChange={set('intro_text_kz')}
                placeholder="Олимпиада ережелері..." className={textareaCls} />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}>
              {saving ? 'Сохранение...' : editingId ? 'Сохранить' : 'Создать'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500">
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {olympiads.map(o => (
          <div key={o.id}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-bold text-gray-800">{o.name_ru}</div>
                <div className="mt-0.5 text-xs text-gray-400">{o.name_kz}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-xs text-gray-400">
                  <span>{o.duration_minutes} мин</span>
                  {o.start_time && <span>{toLocalString(o.start_time)}</span>}
                  <span>🥇≥{o.cert_range_winner_min}% 🥈≥{o.cert_range_prize_min}%</span>
                  {o.intro_video_url && <span className="text-orange-400">▶ видео</span>}
                  {o.intro_text_ru && <span className="text-[#1ec8c8]">✎ правила</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={o.status}
                  onChange={e => setStatus(o, e.target.value)}
                  className="rounded-lg border px-2.5 py-1 font-mono text-xs font-bold outline-none"
                  style={{
                    borderColor: STATUS_COLORS[o.status] + '60',
                    background: STATUS_COLORS[o.status] + '18',
                    color: STATUS_COLORS[o.status],
                  }}>
                  {ALL_STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <button onClick={() => handleCopy(o)} title="Создать копию"
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-[#f47920] hover:text-[#f47920]">
                  ⎘
                </button>
                <button onClick={() => openEdit(o)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]">
                  ✎
                </button>
                <button onClick={() => handleDelete(o)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-300 hover:border-red-300 hover:text-red-400">
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
        {olympiads.length === 0 && (
          <div className="py-12 text-center text-gray-400">Нет олимпиад. Создайте первую.</div>
        )}
      </div>
    </div>
  )
}
