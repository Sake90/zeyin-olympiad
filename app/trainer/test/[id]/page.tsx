import { notFound, redirect } from 'next/navigation'
import { getTrainerSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import type { TrainerAttemptStatus } from '@/lib/trainer'
import TrainerConfirmClient from './TrainerConfirmClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

export default async function TrainerTestConfirmPage({ params }: PageProps) {
  const session = await getTrainerSession()
  if (!session) redirect('/trainer/login')

  const db = createServiceClient()

  const [testRes, countRes, attemptRes] = await Promise.all([
    db
      .from('trainer_tests')
      .select('id, title, description, is_unlocked, unlock_at, time_limit_minutes')
      .eq('id', params.id)
      .maybeSingle(),
    db
      .from('trainer_questions')
      .select('id', { count: 'exact', head: true })
      .eq('test_id', params.id),
    db
      .from('trainer_attempts')
      .select('id, status')
      .eq('student_id', session.studentId)
      .eq('test_id', params.id)
      .maybeSingle(),
  ])

  const test = testRes.data
  if (!test) notFound()

  const status = attemptRes.data?.status as TrainerAttemptStatus | undefined

  // If the student has already finished, send them to the results page.
  if (status === 'submitted' || status === 'auto_submitted') {
    redirect(`/trainer/test/${params.id}/results`)
  }

  // If a run is in progress, skip the confirmation screen.
  if (status === 'in_progress') {
    redirect(`/trainer/test/${params.id}/run`)
  }

  // No attempt yet — verify the test is actually available.
  const unlocked =
    test.is_unlocked &&
    (test.unlock_at == null || new Date(test.unlock_at).getTime() <= Date.now())
  if (!unlocked) {
    redirect('/trainer')
  }

  return (
    <TrainerConfirmClient
      testId={test.id}
      title={test.title}
      description={test.description}
      totalQuestions={countRes.count ?? 0}
      timeLimitMinutes={test.time_limit_minutes}
    />
  )
}
