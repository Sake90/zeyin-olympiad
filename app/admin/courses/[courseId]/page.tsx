'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/admin/Toast'
import type { Course, Topic } from '@/lib/supabase'

const INPUT_CLS = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'
const BTN_PRIMARY_CLS = 'rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50'
const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }
const BTN_SECONDARY_CLS = 'rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300'
const BTN_GHOST_CLS = 'rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-gray-300 disabled:opacity-40'

export default function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const { toast } = useToast()
  const router = useRouter()
  const [course, setCourse] = useState<Course | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTopic, setNewTopic] = useState({ title_ru: '', title_kz: '' })

  useEffect(() => { load() }, [params.courseId])
  async function load() {
    setLoading(true)
    const r = await fetch(`/api/admin/courses/${params.courseId}/topics`)
    if (!r.ok) { toast.error('Не удалось загрузить'); setLoading(false); return }
    const d = await r.json()
    setCourse(d.course); setTopics(d.topics)
    setLoading(false)
  }

  async function togglePublished(t: Topic) {
    const res = await fetch(`/api/admin/courses/${params.courseId}/topics?id=${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !t.is_published }),
    })
    if (!res.ok) { toast.error('Ошибка'); return }
    load()
  }

  async function swap(idx: number, dir: -1 | 1) {
    const a = topics[idx], b = topics[idx + dir]
    if (!a || !b) return
    await Promise.all([
      fetch(`/api/admin/courses/${params.courseId}/topics?id=${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_num: b.order_num }),
      }),
      fetch(`/api/admin/courses/${params.courseId}/topics?id=${b.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_num: a.order_num }),
      }),
    ])
    load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить тему со всем содержимым?')) return
    const res = await fetch(`/api/admin/courses/${params.courseId}/topics?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    toast.success('Удалено'); load()
  }

  async function createTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!newTopic.title_ru.trim()) { toast.error('title_ru обязателен'); return }
    const maxOrder = topics.reduce((m, t) => Math.max(m, t.order_num), 0)
    const res = await fetch(`/api/admin/courses/${params.courseId}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTopic, order_num: maxOrder + 1 }),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setShowAdd(false); setNewTopic({ title_ru: '', title_kz: '' }); toast.success('Добавлено'); load()
  }

  if (loading) return <div className="text-sm text-gray-400">Загрузка…</div>
  if (!course) return <div className="text-sm text-gray-400">Курс не найден</div>

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <Link href="/admin/courses" className="text-xs text-gray-500 hover:text-[#1ec8c8]">← Все курсы</Link>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black text-gray-800">{course.title_ru}</h1>
        {course.title_kz && <div className="text-sm text-gray-500">{course.title_kz}</div>}
        <div className="mt-2 flex gap-3 text-xs text-gray-500">
          {course.subject && <span>📖 {course.subject}</span>}
          {course.grade && <span>🎓 {course.grade} класс</span>}
          <span>{course.is_active ? '🟢 Активен' : '⚪ Не активен'}</span>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-gray-800">Темы ({topics.length})</h2>
        {!showAdd && (
          <button className={BTN_PRIMARY_CLS} style={BTN_PRIMARY_STYLE} onClick={() => setShowAdd(true)}>
            + Добавить тему
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={createTopic} className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-gray-300 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
          <input className={INPUT_CLS} placeholder="Название (RU) *" value={newTopic.title_ru} onChange={e => setNewTopic(v => ({ ...v, title_ru: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="Название (KZ)" value={newTopic.title_kz} onChange={e => setNewTopic(v => ({ ...v, title_kz: e.target.value }))} />
          <div className="flex gap-2">
            <button type="submit" className={BTN_PRIMARY_CLS} style={BTN_PRIMARY_STYLE}>Создать</button>
            <button type="button" className={BTN_SECONDARY_CLS} onClick={() => setShowAdd(false)}>Отмена</button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {topics.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Пока нет тем</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400 w-16">№</th>
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Название</th>
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Статус</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t, idx) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{t.order_num}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/courses/${params.courseId}/topics/${t.id}`}
                      className="font-bold text-gray-800 hover:text-[#1ec8c8]"
                    >
                      {t.title_ru}
                    </Link>
                    {t.title_kz && <div className="text-xs text-gray-400">{t.title_kz}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => togglePublished(t)}
                      className="relative h-6 w-11 rounded-full"
                      style={{ background: t.is_published ? '#1ec8c8' : '#e5e7eb' }}
                    >
                      <span
                        className="absolute top-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform"
                        style={{ transform: t.is_published ? 'translateX(22px)' : 'translateX(2px)' }}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className={BTN_GHOST_CLS} disabled={idx === 0} onClick={() => swap(idx, -1)}>↑</button>
                      <button className={BTN_GHOST_CLS} disabled={idx === topics.length - 1} onClick={() => swap(idx, 1)}>↓</button>
                      <Link href={`/admin/courses/${params.courseId}/topics/${t.id}`} className={BTN_GHOST_CLS}>✎</Link>
                      <button className={BTN_GHOST_CLS + ' hover:border-red-300 hover:text-red-500'} onClick={() => remove(t.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
