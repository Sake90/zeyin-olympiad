'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type CardState =
  | 'locked_time'
  | 'locked_manual'
  | 'available'
  | 'in_progress'
  | 'completed'

export interface CatalogCard {
  id: string
  title: string
  description: string | null
  unlock_at: string | null
  time_limit_minutes: number | null
  total_questions: number
  score: number | null
  state: CardState
}

interface Props {
  fullName: string
  classLabel: string
  cards: CatalogCard[]
}

function formatUnlockAt(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm} в ${hh}:${mi}`
}

export default function TrainerCatalogClient({ fullName, classLabel, cards }: Props) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/trainer/auth/login', { method: 'DELETE' })
    router.push('/trainer/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-gray-400">Тренажер · {classLabel}</div>
            <h1 className="mt-1 text-2xl font-black text-gray-800">Привет, {fullName}!</h1>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 transition-all hover:border-red-300 hover:text-red-500 disabled:opacity-60"
          >
            {loggingOut ? 'Выход...' : 'Выйти'}
          </button>
        </div>

        <h2 className="mb-4 text-lg font-bold text-gray-800">Мои тесты</h2>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400">
            Пока нет доступных тестов.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cards.map(card => (
              <TestCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TestCard({ card }: { card: CatalogCard }) {
  const locked = card.state === 'locked_time' || card.state === 'locked_manual'

  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 shadow-sm transition-all ${
        locked
          ? 'border-gray-200 bg-gray-50'
          : card.state === 'in_progress'
            ? 'border-[#1ec8c8] bg-white'
            : 'border-gray-200 bg-white hover:border-[#1ec8c8]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={`text-base font-bold ${locked ? 'text-gray-400' : 'text-gray-800'}`}>
          {card.title}
        </h3>
        {card.state === 'completed' && (
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: '#1ec8c8' }}
            aria-label="Пройден"
          >
            ✓
          </span>
        )}
        {locked && (
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-base text-gray-300"
            aria-label="Заблокирован"
          >
            🔒
          </span>
        )}
      </div>

      {card.description && (
        <p className={`mt-1 text-xs ${locked ? 'text-gray-400' : 'text-gray-500'}`}>
          {card.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="font-mono">
          {card.total_questions === 0 ? 'Нет вопросов' : `${card.total_questions} вопросов`}
        </span>
        {card.time_limit_minutes != null && (
          <span className="flex items-center gap-1 font-mono">
            <span aria-hidden>⏱</span>
            {card.time_limit_minutes} минут
          </span>
        )}
      </div>

      {card.state === 'completed' && card.score != null && (
        <div className="mt-3 text-sm text-gray-700">
          Результат:{' '}
          <span className="font-bold text-[#1ec8c8]">
            {card.score} / {card.total_questions}
          </span>
        </div>
      )}

      <div className="mt-4 flex-grow" />

      <CardCta card={card} />
    </div>
  )
}

function CardCta({ card }: { card: CatalogCard }) {
  if (card.state === 'locked_time') {
    return (
      <div className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs text-gray-500">
        {card.unlock_at ? `Откроется ${formatUnlockAt(card.unlock_at)}` : 'Скоро'}
      </div>
    )
  }
  if (card.state === 'locked_manual') {
    return (
      <div className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs text-gray-500">
        Скоро
      </div>
    )
  }
  if (card.state === 'completed') {
    return (
      <Link
        href={`/trainer/test/${card.id}/results`}
        className="block rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm font-bold text-gray-700 transition-all hover:border-[#1ec8c8] hover:text-[#1ec8c8]"
      >
        Посмотреть разбор
      </Link>
    )
  }
  if (card.state === 'in_progress') {
    return (
      <Link
        href={`/trainer/test/${card.id}/run`}
        className="block rounded-xl py-2.5 text-center text-sm font-bold text-white transition-all"
        style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
      >
        Продолжить
      </Link>
    )
  }
  // available
  return (
    <Link
      href={`/trainer/test/${card.id}`}
      className="block rounded-xl py-2.5 text-center text-sm font-bold text-white transition-all"
      style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
    >
      Начать
    </Link>
  )
}
