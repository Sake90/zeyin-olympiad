'use client'

import { useRouter } from 'next/navigation'
import TestRunner, { type RunnerQuestion, type RunnerInitialAnswer, type RunOption } from '@/components/trainer/TestRunner'

export type RunQuestion = RunnerQuestion
export type RunAnswer = RunnerInitialAnswer

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

  async function onSelectOption(questionId: string, option: RunOption) {
    const res = await fetch('/api/trainer/attempts/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: option,
      }),
    })
    return res.ok
  }

  async function onFinish(reason?: 'timeout') {
    const res = await fetch('/api/trainer/attempts/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attempt_id: attemptId, reason }),
    })
    // 409 means it's already in a terminal state — also navigate to results.
    if (res.ok || res.status === 409) {
      router.push(`/trainer/test/${testId}/results`)
      router.refresh()
    }
  }

  return (
    <TestRunner
      title={title}
      questions={questions}
      initialAnswers={initialAnswers}
      startIndex={startIndex}
      timer={timeLimitMinutes != null ? { startedAtIso, timeLimitMinutes } : null}
      onSelectOption={onSelectOption}
      onFinish={onFinish}
    />
  )
}
