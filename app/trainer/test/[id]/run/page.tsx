import { redirect, notFound } from 'next/navigation'
import { getTrainerSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { autoSubmitIfExpired, firstUnansweredIndex, type TrainerAttemptStatus } from '@/lib/trainer'
import TrainerRunClient, { type RunQuestion, type RunAnswer } from './TrainerRunClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

export default async function TrainerTestRunPage({ params }: PageProps) {
  const session = await getTrainerSession()
  if (!session) redirect('/trainer/login')

  const db = createServiceClient()

  const { data: test } = await db
    .from('trainer_tests')
    .select('id, title, time_limit_minutes')
    .eq('id', params.id)
    .maybeSingle()
  if (!test) notFound()

  const { data: attempt } = await db
    .from('trainer_attempts')
    .select('id, status, started_at')
    .eq('student_id', session.studentId)
    .eq('test_id', params.id)
    .maybeSingle()

  if (!attempt) {
    redirect(`/trainer/test/${params.id}`)
  }

  let status = attempt.status as TrainerAttemptStatus
  if (status === 'in_progress') {
    status = await autoSubmitIfExpired({
      attemptId: attempt.id,
      testTimeLimitMinutes: test.time_limit_minutes,
      startedAt: attempt.started_at,
      currentStatus: status,
    })
  }

  if (status !== 'in_progress') {
    redirect(`/trainer/test/${params.id}/results`)
  }

  // Fetch questions WITHOUT correct_option / explanation — students must not
  // see correctness during the run.
  const { data: questionRows } = await db
    .from('trainer_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, order_index')
    .eq('test_id', params.id)
    .order('order_index', { ascending: true })

  const questions: RunQuestion[] = (questionRows ?? []).map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
  }))

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          В тесте нет вопросов.
        </div>
      </div>
    )
  }

  const { data: answerRows } = await db
    .from('trainer_answers')
    .select('question_id, selected_option')
    .eq('attempt_id', attempt.id)

  const answers: RunAnswer[] = (answerRows ?? []).map(a => ({
    question_id: a.question_id,
    selected_option: a.selected_option as 'A' | 'B' | 'C' | 'D',
  }))

  const startIndex = firstUnansweredIndex(questions, answers)

  return (
    <TrainerRunClient
      attemptId={attempt.id}
      testId={test.id}
      title={test.title}
      questions={questions}
      initialAnswers={answers}
      startIndex={startIndex}
      startedAtIso={attempt.started_at}
      timeLimitMinutes={test.time_limit_minutes}
    />
  )
}
