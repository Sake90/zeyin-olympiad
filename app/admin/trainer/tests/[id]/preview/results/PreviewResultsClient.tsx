'use client'

import { useEffect, useState } from 'react'
import TestResults, { type ResultsQuestion, type ResultsAnswer, type ResultsOption } from '@/components/trainer/TestResults'
import { previewStorageKey } from '../PreviewRunClient'

export type PreviewResultsQuestion = ResultsQuestion

const PREVIEW_BANNER = (
  <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
    👁 Режим предпросмотра. Это то, что увидит ученик после прохождения.
  </div>
)

interface Props {
  testId: string
  title: string
  questions: PreviewResultsQuestion[]
}

export default function PreviewResultsClient({ testId, title, questions }: Props) {
  const [picked, setPicked] = useState<Record<string, ResultsOption>>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(previewStorageKey(testId))
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, ResultsOption>
        if (parsed && typeof parsed === 'object') setPicked(parsed)
      }
    } catch {
      // ignore
    }
    setHydrated(true)
  }, [testId])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-sm text-gray-400">Загрузка...</div>
      </div>
    )
  }

  const answers: ResultsAnswer[] = Object.entries(picked).map(([qid, opt]) => {
    const q = questions.find(x => x.id === qid)
    return {
      question_id: qid,
      selected_option: opt,
      is_correct: q ? q.correct_option === opt : false,
    }
  })

  const total = questions.length
  const score = answers.filter(a => a.is_correct).length

  return (
    <TestResults
      title={`${title} · Превью`}
      score={score}
      total={total}
      autoSubmitted={false}
      questions={questions}
      answers={answers}
      backHref={`/admin/trainer/tests/${testId}`}
      backLabel="К редактору теста"
      banner={PREVIEW_BANNER}
    />
  )
}
