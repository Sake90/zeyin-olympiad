'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface RunQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
}

export interface RunAnswer {
  question_id: string
  selected_option: 'A' | 'B' | 'C' | 'D'
}

type Option = 'A' | 'B' | 'C' | 'D'
const OPTION_KEYS: Option[] = ['A', 'B', 'C', 'D']

interface Props {
  attemptId: string
  testId: string
  title: string
  questions: RunQuestion[]
  initialAnswers: RunAnswer[]
  startIndex: number
  startedAtIso: string
  timeLimitMinutes: number | null
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export default function TrainerRunClient({
  attemptId,
  testId,
  title,
  questions,
  initialAnswers,
  startIndex,
  startedAtIso,
  timeLimitMinutes,
}: Props) {
  const router = useRouter()
  const [index, setIndex] = useState(startIndex)
  const [answers, setAnswers] = useState<Record<string, Option>>(() => {
    const init: Record<string, Option> = {}
    for (const a of initialAnswers) init[a.question_id] = a.selected_option
    return init
  })
  const [savingFor, setSavingFor] = useState<string | null>(null)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')

  const total = questions.length
  const current = questions[index]
  const isLast = index === total - 1

  // Timer: only if time_limit_minutes is set.
  const deadlineMs = useMemo(() => {
    if (timeLimitMinutes == null) return null
    return new Date(startedAtIso).getTime() + timeLimitMinutes * 60 * 1000
  }, [startedAtIso, timeLimitMinutes])

  const [remainingSec, setRemainingSec] = useState<number | null>(() => {
    if (deadlineMs == null) return null
    return Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000))
  })

  const autoSubmittedRef = useRef(false)

  useEffect(() => {
    if (deadlineMs == null) return
    const tick = () => {
      const left = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000))
      setRemainingSec(left)
      if (left === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true
        void doFinish('timeout')
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineMs])

  async function selectOption(opt: Option) {
    if (!current) return
    const previous = answers[current.id]
    setAnswers(prev => ({ ...prev, [current.id]: opt }))
    setSavingFor(current.id)
    setError('')
    try {
      const res = await fetch('/api/trainer/attempts/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: attemptId,
          question_id: current.id,
          selected_option: opt,
        }),
      })
      if (!res.ok) {
        // Revert on failure so the user knows it didn't save.
        setAnswers(prev => {
          const next = { ...prev }
          if (previous) next[current.id] = previous
          else delete next[current.id]
          return next
        })
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Не удалось сохранить ответ')
      }
    } catch {
      setAnswers(prev => {
        const next = { ...prev }
        if (previous) next[current.id] = previous
        else delete next[current.id]
        return next
      })
      setError('Ошибка сети')
    } finally {
      setSavingFor(null)
    }
  }

  async function doFinish(reason?: 'timeout') {
    setFinishing(true)
    setError('')
    try {
      const res = await fetch('/api/trainer/attempts/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id: attemptId, reason }),
      })
      if (res.ok) {
        router.push(`/trainer/test/${testId}/results`)
        router.refresh()
        return
      }
      // 409 means it's already in a terminal state — also send to results.
      if (res.status === 409) {
        router.push(`/trainer/test/${testId}/results`)
        router.refresh()
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Не удалось завершить тест')
      setFinishing(false)
    } catch {
      setError('Ошибка сети')
      setFinishing(false)
    }
  }

  if (!current) return null

  const progressPct = Math.round(((index + 1) / total) * 100)
  const selected = answers[current.id]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header: progress + timer */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="font-mono text-xs text-gray-500">
            Вопрос {index + 1} из {total}
          </div>
          {remainingSec != null && (
            <div
              className={`rounded-full px-3 py-1 font-mono text-xs ${
                remainingSec <= 60
                  ? 'bg-red-50 text-red-600'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              ⏱ Осталось: {formatRemaining(remainingSec)}
            </div>
          )}
        </div>

        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full transition-all"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #0fa8a8, #1ec8c8)',
            }}
          />
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-mono text-gray-400">{title}</div>
          <h1 className="mt-1 whitespace-pre-line text-lg font-bold text-gray-800">
            {current.question_text}
          </h1>

          <div className="mt-5 flex flex-col gap-2.5">
            {OPTION_KEYS.map(key => {
              const text = current[`option_${key.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d']
              const isSelected = selected === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectOption(key)}
                  disabled={finishing}
                  className={`flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm transition-all ${
                    isSelected
                      ? 'border-[#1ec8c8] bg-[#1ec8c8]/5 text-gray-900'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                      isSelected
                        ? 'bg-[#1ec8c8] text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {key}
                  </span>
                  <span className="flex-grow whitespace-pre-line">{text}</span>
                </button>
              )
            })}
          </div>

          {savingFor === current.id && (
            <div className="mt-3 text-xs text-gray-400">Сохраняю...</div>
          )}
          {error && <div className="mt-3 text-xs text-red-500">{error}</div>}
        </div>

        {/* Nav */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => setIndex(i => Math.max(0, i - 1))}
            disabled={index === 0 || finishing}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 transition-all disabled:opacity-40"
          >
            ← Назад
          </button>
          {!isLast ? (
            <button
              type="button"
              onClick={() => setIndex(i => Math.min(total - 1, i + 1))}
              disabled={finishing}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
            >
              Далее →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowFinishModal(true)}
              disabled={finishing}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #d4145a, #f47920)' }}
            >
              Завершить тест
            </button>
          )}
        </div>
      </div>

      {showFinishModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !finishing && setShowFinishModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800">Уверен?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Изменить ответы потом будет нельзя.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                disabled={finishing}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-600 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => doFinish()}
                disabled={finishing}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
              >
                {finishing ? 'Завершаем...' : 'Да, завершить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
