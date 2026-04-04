'use client'

import { useEffect, useState, useRef } from 'react'

const DISTRICTS = [
  'Қызылорда қаласы', 'Арал ауданы', 'Жалағаш ауданы', 'Қармақшы ауданы',
  'Қазалы ауданы', 'Сырдария ауданы', 'Шиелі ауданы', 'Жаңақорған ауданы',
]

interface Student {
  id: string
  full_name: string
  school: string | null
  grade: string | null
  district: string | null
  language: string
  login: string
  password_plain: string
  whatsapp: string | null
  registered_at: string
  olympiad_id: string | null
}

interface Olympiad {
  id: string
  name_ru: string
}

const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [selectedOlympiad, setSelectedOlympiad] = useState('')
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [districtFilter, setDistrictFilter] = useState('')
  const [form, setForm] = useState({ full_name: '', school: '', grade: '', district: '', language: 'ru', whatsapp: '' })
  const [adding, setAdding] = useState(false)

  async function loadOlympiads() {
    const res = await fetch('/api/admin/olympiads')
    if (res.ok) setOlympiads(await res.json())
  }

  async function loadStudents() {
    const params = new URLSearchParams({
      page: String(page), limit: '50',
      ...(selectedOlympiad && { olympiad_id: selectedOlympiad }),
      ...(search && { search }),
    })
    const res = await fetch(`/api/admin/students?${params}`)
    if (res.ok) {
      const data = await res.json()
      setStudents(data.students ?? [])
      setTotal(data.total ?? 0)
    }
  }

  useEffect(() => { loadOlympiads() }, [])
  useEffect(() => { loadStudents() }, [page, selectedOlympiad, search]) // eslint-disable-line

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, olympiad_id: selectedOlympiad || null }),
    })
    setAdding(false)
    if (res.ok) {
      setShowAddForm(false)
      setForm({ full_name: '', school: '', grade: '', district: '', language: 'ru', whatsapp: '' })
      loadStudents()
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file)
    if (selectedOlympiad) fd.append('olympiad_id', selectedOlympiad)
    const res = await fetch('/api/admin/students', { method: 'PATCH', body: fd })
    setImporting(false)
    if (res.ok) {
      const data = await res.json()
      alert(`Импортировано: ${data.imported} учеников`)
      loadStudents()
    } else {
      const err = await res.json()
      alert('Ошибка: ' + err.error)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить ученика?')) return
    await fetch(`/api/admin/students?id=${id}`, { method: 'DELETE' })
    loadStudents()
  }

  function handleExport() {
    const params = selectedOlympiad ? `?olympiad_id=${selectedOlympiad}` : ''
    window.open(`/api/admin/students/export${params}`, '_blank')
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-800">
          Ученики <span className="font-mono text-base text-gray-400">({total})</span>
        </h1>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]">
            ↓ Excel
          </button>
          <label className={`cursor-pointer rounded-xl border border-gray-200 px-3 py-2 text-sm ${importing ? 'text-gray-300' : 'text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]'}`}>
            {importing ? 'Импорт...' : '↑ Импорт Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={() => setShowAddForm(true)}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}>
            + Добавить
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <select value={selectedOlympiad} onChange={e => { setSelectedOlympiad(e.target.value); setPage(1) }}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1ec8c8]">
          <option value="">Все олимпиады</option>
          {olympiads.map(o => <option key={o.id} value={o.id}>{o.name_ru}</option>)}
        </select>
        <select value={districtFilter} onChange={e => { setDistrictFilter(e.target.value); setPage(1) }}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1ec8c8]">
          <option value="">Все районы</option>
          {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="text" placeholder="Поиск по имени..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-[#1ec8c8]" />
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd}
          className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-bold text-gray-800">Добавить ученика</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-gray-500">ФИО</label>
              <input type="text" value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                required className={inputCls} />
            </div>
            {[{ key: 'school', label: 'Школа' }, { key: 'grade', label: 'Класс' }, { key: 'whatsapp', label: 'WhatsApp' }].map(f => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-500">{f.label}</label>
                <input type="text" value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inputCls} />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs text-gray-500">Аудан / Район</label>
              <select value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))}
                className={inputCls}>
                <option value="">— Таңдаңыз —</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Язык</label>
              <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}
                className={inputCls}>
                <option value="ru">Русский</option>
                <option value="kz">Қазақша</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={adding}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}>
              {adding ? 'Добавление...' : 'Добавить'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['ФИО', 'Район', 'Школа / Класс', 'Логин', 'Пароль', 'WhatsApp', ''].map(h => (
                <th key={h} className="px-4 py-3 font-mono text-xs font-bold text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{s.full_name}</div>
                  <div className="font-mono text-xs text-gray-400">{s.language.toUpperCase()}</div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.district ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">
                  <div>{s.school ?? '—'}</div>
                  <div className="font-mono text-xs">{s.grade ?? ''}</div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => copyText(s.login, s.id + '_login')}
                    className="font-mono text-[#1ec8c8] hover:opacity-70">
                    {s.login} {copied === s.id + '_login' ? '✓' : ''}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => copyText(s.password_plain, s.id + '_pw')}
                    className="font-mono text-[#f47920] hover:opacity-70">
                    {s.password_plain} {copied === s.id + '_pw' ? '✓' : ''}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{s.whatsapp ?? '—'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(s.id)}
                    className="text-xs text-gray-300 hover:text-red-400">✕</button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">Нет учеников</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="mt-4 flex items-center justify-between font-mono text-sm text-gray-400">
          <span>Показано {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} из {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-30">←</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}
              className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-30">→</button>
          </div>
        </div>
      )}
    </div>
  )
}
