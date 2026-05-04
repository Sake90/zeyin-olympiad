import { notFound, redirect } from 'next/navigation'
import { getTrainerSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import type { TrainerAttemptStatus } from '@/lib/trainer'
import TestResults, { type ResultsQuestion, type ResultsAnswer } from '@/components/trainer/TestResults'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

export default async function TrainerTestResultsPage({ params }: PageProps) {
  const session = await getTrainerSession()
  if (!session) redirect('/trainer/login')

  const db = createServiceClient()

  const { data: test } = await db
    .from('trainer_tests')
    .select('id, title')
    .eq('id', params.id)
    .maybeSingle()
  if (!test) notFound()

  const { data: attempt } = await db
    .from('trainer_attempts')
    .select('id, status, score, finished_at')
    .eq('student_id', session.studentId)
    .eq('test_id', params.id)
    .maybeSingle()

  const status = attempt?.status as TrainerAttemptStatus | undefined
  if (!attempt || (status !== 'submitted' && status !== 'auto_submitted')) {
    redirect(`/trainer/test/${params.id}`)
  }

  const [questionsRes, answersRes] = await Promise.all([
    db
      .from('trainer_questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, order_index')
      .eq('test_id', params.id)
      .order('order_index', { ascending: true }),
    db
      .from('trainer_answers')
      .select('question_id, selected_option, is_correct')
      .eq('attempt_id', attempt.id),
  ])

  const questions = (questionsRes.data ?? []) as ResultsQuestion[]
  const answers = (answersRes.data ?? []) as ResultsAnswer[]

  const total = questions.length
  const score = attempt.score ?? answers.filter(a => a.is_correct).length

  return (
    <TestResults
      title={test.title}
      score={score}
      total={total}
      autoSubmitted={status === 'auto_submitted'}
      questions={questions}
      answers={answers}
      backHref="/trainer"
      backLabel="К списку тестов"
    />
  )
}
