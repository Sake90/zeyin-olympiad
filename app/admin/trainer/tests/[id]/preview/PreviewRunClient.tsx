'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import TestRunner, { type RunnerQuestion, type RunOption } from '@/components/trainer/TestRunner'

export type PreviewQuestion = RunnerQuestion

const PREVIEW_BANNER = (
  <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
    👁 Режим предпросмотра. Ответы не сохраняются.
  </div>
)

export const previewStorageKey = (testId: string) => `trainer_preview_answers_${testId}`

interface Props {
  testId: string
  title: string
  questions: PreviewQuestion[]
}

export default function PreviewRunClient({ testId, title, questions }: Props) {
  const router = useRouter()
  const answersRef = useRef<Record<string, RunOption>>({})

  async function onSelectOption(questionId: string, option: RunOption) {
    answersRef.current = { ...answersRef.current, [questionId]: option }
    return true
  }

  async function onFinish() {
    try {
      sessionStorage.setItem(
        previewStorageKey(testId),
        JSON.stringify(answersRef.current)
      )
    } catch {
      // sessionStorage might be disabled — graceful fallback.
    }
    router.push(`/admin/trainer/tests/${testId}/preview/results`)
  }

  return (
    <TestRunner
      title={`${title} · Превью`}
      questions={questions}
      initialAnswers={[]}
      startIndex={0}
      timer={null}
      banner={PREVIEW_BANNER}
      onSelectOption={onSelectOption}
      onFinish={onFinish}
    />
  )
}
