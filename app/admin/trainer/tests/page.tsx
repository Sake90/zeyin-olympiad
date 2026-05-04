'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/admin/Toast'

interface AdminTest {
  id: string
  title: string
  description: string | null
  order_index: number
  unlock_at: string | null
  is_unlocked: boolean
  time_limit_minutes: number | null
  question_count: number
  attempt_count: number
}

function formatUnlock(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm} ${hh}:${mi}`
}

function stateBadge(t: AdminTest): { label: string; cls: string } {
  if (t.is_unlocked) {
    return { label: '🔓 Открыт', cls: 'bg-emerald-50 text-emerald-700' }
  }
  if (t.unlock_at && new Date(t.unlock_at).getTime() > Date.now()) {
    return { label: `🔒 Откроется ${formatUnlock(t.unlock_at)}`, cls: 'bg-gray-100 text-gray-600' }
  }
  return { label: '🔒 Скоро', cls: 'bg-gray-100 text-gray-500' }
}

export default function TrainerTestsListPage() {
  const { toast } = useToast()
  const [tests, setTests] = useState<AdminTest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<AdminTest | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/trainer/tests')
    if (res.ok) {
      const data = await res.json()
      setTests(data.tests ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function move(id: string, direction: 'up' | 'down') {
    const res = await fetch(`/api/admin/trainer/tests/${id}/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    if (res.ok) load()
    else toast.error('Не удалось переместить')
  }

  async function doDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    const res = await fetch(`/api/admin/trainer/tests/${confirmDelete.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success(`Тест «${confirmDelete.title}» удалён`)
      setConfirmDelete(null)
      load()
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error('Ошибка: ' + (err.error ?? 'не удалось удалить'))
    }
  }

  const filtered = search.trim()
    ? tests.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase()))
    : tests

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-800">
            Тренажер · Тесты{' '}
            <span className="font-mono text-base text-gray-400">({tests.length})</span>
          </h1>
          <p className="mt-1 text-xs text-gray-400">6 класс</p>
        </div>
        <Link
          href="/admin/trainer/tests/new"
          className="rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
        >
          + Создать тест
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#1ec8c8]"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['№', 'Название', 'Вопросов', 'Лимит', 'Состояние', 'Попыток', ''].map(h => (
                <th key={h} className="px-3 py-3 font-mono text-xs font-bold text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, idx) => {
              const badge = stateBadge(t)
              return (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-gray-400">{t.order_index}</span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => move(t.id, 'up')}
                          disabled={idx === 0}
                          className="text-[10px] leading-none text-gray-300 hover:text-[#1ec8c8] disabled:opacity-20"
                          title="Выше"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => move(t.id, 'down')}
                          disabled={idx === filtered.length - 1}
                          className="text-[10px] leading-none text-gray-300 hover:text-[#1ec8c8] disabled:opacity-20"
                          title="Ниже"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-800">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-gray-400">{t.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">
                    {t.question_count}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">
                    {t.time_limit_minutes != null ? `${t.time_limit_minutes} мин` : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">
                    {t.attempt_count}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/admin/trainer/tests/${t.id}`}
                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]"
                      >
                        ✎
                      </Link>
                      <a
                        href={`/admin/trainer/tests/${t.id}/preview`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-[#f47920] hover:text-[#f47920]"
                        title="Превью"
                      >
                        👁
                      </a>
                      <button
                        onClick={() => setConfirmDelete(t)}
                        className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-300 hover:border-red-300 hover:text-red-400"
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  {tests.length === 0 ? 'Нет тестов. Создайте первый.' : 'Ничего не найдено.'}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">Загрузка...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800">
              Удалить тест «{confirmDelete.title}»?
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Все попытки и ответы учеников будут удалены.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-600 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                onClick={doDelete}
                disabled={deleting}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #d4145a, #f47920)' }}
              >
                {deleting ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
