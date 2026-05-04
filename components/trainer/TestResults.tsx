'use client'

import Link from 'next/link'

export type ResultsOption = 'A' | 'B' | 'C' | 'D'
const OPTION_KEYS: ResultsOption[] = ['A', 'B', 'C', 'D']

export interface ResultsQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: ResultsOption
  explanation: string | null
}

export interface ResultsAnswer {
  question_id: string
  selected_option: ResultsOption
  is_correct: boolean
}

export interface TestResultsProps {
  title: string
  score: number
  total: number
  autoSubmitted: boolean
  questions: ResultsQuestion[]
  answers: ResultsAnswer[]
  /** Where the bottom button goes back to. */
  backHref: string
  backLabel: string
  /** Optional banner above the score (preview-mode notice etc). */
  banner?: React.ReactNode
}

export default function TestResults(props: TestResultsProps) {
  const { title, score, total, autoSubmitted, questions, answers, backHref, backLabel, banner } = props

  const answerByQ = new Map<string, ResultsAnswer>()
  for (const a of answers) answerByQ.set(a.question_id, a)
  const pct = total > 0 ? Math.round((score / total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {banner}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="text-xs font-mono text-gray-400">{title}</div>
          <div className="mt-2 text-4xl font-black text-gray-800">
            {score} <span className="text-gray-400">из</span> {total}
          </div>
          <div className="mt-1 text-sm font-mono text-[#1ec8c8]">{pct}%</div>
          {autoSubmitted && (
            <div className="mt-2 text-xs text-gray-400">Время вышло</div>
          )}
        </div>

        <h2 className="mt-8 mb-4 text-base font-bold text-gray-800">Разбор</h2>

        <div className="flex flex-col gap-4">
          {questions.map((q, idx) => {
            const a = answerByQ.get(q.id) ?? null
            const noAnswer = a == null

            return (
              <div
                key={q.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-xs text-gray-400">
                    Вопрос {idx + 1}
                  </div>
                  {noAnswer && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                      Без ответа
                    </span>
                  )}
                </div>
                <div className="mt-2 whitespace-pre-line text-base font-bold text-gray-800">
                  {q.question_text}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {OPTION_KEYS.map(key => {
                    const text = q[`option_${key.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d']
                    const isCorrect = q.correct_option === key
                    const isSelected = a?.selected_option === key

                    let cls = 'border-gray-200 bg-white text-gray-600'
                    let badge: React.ReactNode = null
                    let suffix: React.ReactNode = null

                    if (isSelected && a?.is_correct) {
                      cls = 'border-emerald-400 bg-emerald-50 text-emerald-900'
                      badge = (
                        <span className="text-emerald-600" aria-label="Верно">✓</span>
                      )
                    } else if (isSelected && !a?.is_correct) {
                      cls = 'border-red-400 bg-red-50 text-red-900'
                      badge = (
                        <span className="text-red-600" aria-label="Неверно">✕</span>
                      )
                    }

                    if (isCorrect && (noAnswer || (a && !a.is_correct))) {
                      cls = 'border-emerald-400 bg-emerald-50 text-emerald-900'
                      suffix = (
                        <span className="ml-2 rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900">
                          Правильный ответ
                        </span>
                      )
                    }

                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-sm ${cls}`}
                      >
                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/60 font-mono text-xs font-bold">
                          {key}
                        </span>
                        <span className="flex-grow whitespace-pre-line">{text}</span>
                        {suffix}
                        {badge && <span className="flex-shrink-0 text-base">{badge}</span>}
                      </div>
                    )
                  })}
                </div>

                {q.explanation && (
                  <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                    <span aria-hidden>💡</span> <strong>Объяснение:</strong>{' '}
                    <span className="whitespace-pre-line">{q.explanation}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Link
          href={backHref}
          className="mt-8 block rounded-xl py-3.5 text-center text-sm font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
        >
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
