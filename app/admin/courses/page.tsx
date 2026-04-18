'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/admin/Toast'
import type { Course } from '@/lib/supabase'

const INPUT_CLS = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'
const BTN_PRIMARY_CLS = 'rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50'
const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }
const BTN_SECONDARY_CLS = 'rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300'

type CourseWithCount = Course & { topics: { count: number }[] | { count: number } }

export default function CoursesPage() {
  const { toast } = useToast()
  const [courses, setCourses] = useState<CourseWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/courses')
    if (!r.ok) { toast.error('Не удалось загрузить'); setLoading(false); return }
    setCourses(await r.json())
    setLoading(false)
  }

  async function toggleActive(c: CourseWithCount) {
    const res = await fetch(`/api/admin/courses?id=${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !c.is_active }),
    })
    if (!res.ok) { toast.error('Не удалось обновить'); return }
    load()
  }

  function countTopics(c: CourseWithCount): number {
    if (!c.topics) return 0
    if (Array.isArray(c.topics)) return c.topics[0]?.count ?? 0
    return (c.topics as { count: number }).count ?? 0
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Курсы</h1>
          <p className="text-sm text-gray-500">Иерархия: курс → тема → объяснения и вопросы</p>
        </div>
        <button className={BTN_PRIMARY_CLS} style={BTN_PRIMARY_STYLE} onClick={() => setShowModal(true)}>
          + Создать курс
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Загрузка…</div>
        ) : courses.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Пока нет курсов</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Название</th>
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Предмет</th>
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Класс</th>
                <th className="px-4 py-3 text-right font-mono text-xs font-bold text-gray-400">Тем</th>
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/courses/${c.id}`} className="font-bold text-gray-800 hover:text-[#1ec8c8]">
                      {c.title_ru}
                    </Link>
                    {c.title_kz && <div className="text-xs text-gray-400">{c.title_kz}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.subject ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.grade ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-500">{countTopics(c)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(c)}
                      className="relative h-6 w-11 rounded-full"
                      style={{ background: c.is_active ? '#1ec8c8' : '#e5e7eb' }}
                    >
                      <span
                        className="absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform"
                        style={{ transform: c.is_active ? 'translateX(22px)' : 'translateX(2px)' }}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="text-xs font-bold text-[#1ec8c8] hover:underline"
                    >
                      Открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <CreateCourseModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load() }} />}
    </div>
  )
}

function CreateCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ title_ru: '', title_kz: '', subject: '', grade: '' })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title_ru.trim()) { toast.error('title_ru обязателен'); return }
    setSaving(true)
    const res = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    toast.success('Создано')
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-black text-gray-800">Новый курс</h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold text-gray-500">Название (RU) *</span>
          <input className={INPUT_CLS} value={form.title_ru} onChange={e => setForm({ ...form, title_ru: e.target.value })} />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold text-gray-500">Название (KZ)</span>
          <input className={INPUT_CLS} value={form.title_kz} onChange={e => setForm({ ...form, title_kz: e.target.value })} />
        </label>
        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold text-gray-500">Предмет</span>
          <input className={INPUT_CLS} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Математика, Қазақ тілі..." />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-bold text-gray-500">Класс</span>
          <input className={INPUT_CLS} value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="5" />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" className={BTN_SECONDARY_CLS} onClick={onClose}>Отмена</button>
          <button type="submit" className={BTN_PRIMARY_CLS} style={BTN_PRIMARY_STYLE} disabled={saving}>
            {saving ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}
