'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  testId: string
  title: string
  description: string | null
  totalQuestions: number
  timeLimitMinutes: number | null
}

export default function TrainerConfirmClient({
  testId,
  title,
  description,
  totalQuestions,
  timeLimitMinutes,
}: Props) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    setError('')
    setStarting(true)
    try {
      const res = await fetch('/api/trainer/attempts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: testId }),
      })
      if (res.ok) {
        router.push(`/trainer/test/${testId}/run`)
        router.refresh()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data.error === 'already_completed') {
        router.push(`/trainer/test/${testId}/results`)
        return
      }
      setError(data.error ?? 'Не удалось начать тест')
      setStarting(false)
    } catch {
      setError('Ошибка сети')
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-gray-800">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            <span className="font-mono">
              Вопросов: <strong className="text-gray-800">{totalQuestions}</strong>
            </span>
            {timeLimitMinutes != null && (
              <span className="font-mono">
                Время: <strong className="text-gray-800">{timeLimitMinutes} минут</strong>
              </span>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>У тебя одна попытка.</strong>{' '}
            Можно менять ответы пока не нажмёшь «Завершить тест».
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-500">{error}</p>
          )}

          <button
            onClick={handleStart}
            disabled={starting || totalQuestions === 0}
            className="mt-6 block w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
          >
            {starting ? 'Начинаем...' : 'Начать тест'}
          </button>

          <Link
            href="/trainer"
            className="mt-3 block text-center text-sm text-gray-400 hover:text-gray-600"
          >
            ← Назад к списку
          </Link>
        </div>
      </div>
    </div>
  )
}
