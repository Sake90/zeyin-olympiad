import { redirect } from 'next/navigation'
import { getTrainerSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import type { TrainerAttemptStatus } from '@/lib/trainer'
import TrainerCatalogClient, { type CatalogCard } from './TrainerCatalogClient'

export const dynamic = 'force-dynamic'

type RawTest = {
  id: string
  title: string
  description: string | null
  order_index: number
  unlock_at: string | null
  is_unlocked: boolean
  time_limit_minutes: number | null
}

function deriveState(
  test: RawTest,
  attempt: { status: TrainerAttemptStatus } | null,
  now: number
): CatalogCard['state'] {
  if (attempt) {
    if (attempt.status === 'in_progress') return 'in_progress'
    return 'completed'
  }
  if (test.is_unlocked) {
    if (test.unlock_at && new Date(test.unlock_at).getTime() > now) {
      return 'locked_time'
    }
    return 'available'
  }
  return test.unlock_at ? 'locked_time' : 'locked_manual'
}

export default async function TrainerHomePage() {
  const session = await getTrainerSession()
  if (!session) redirect('/trainer/login')

  const db = createServiceClient()

  const [testsRes, attemptsRes, questionsRes] = await Promise.all([
    db
      .from('trainer_tests')
      .select('id, title, description, order_index, unlock_at, is_unlocked, time_limit_minutes')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }),
    db
      .from('trainer_attempts')
      .select('test_id, status, score')
      .eq('student_id', session.studentId),
    db.from('trainer_questions').select('test_id'),
  ])

  const tests: RawTest[] = (testsRes.data ?? []) as RawTest[]
  const attemptsByTest = new Map<string, { status: TrainerAttemptStatus; score: number | null }>()
  for (const a of attemptsRes.data ?? []) {
    attemptsByTest.set(a.test_id, { status: a.status as TrainerAttemptStatus, score: a.score })
  }
  const questionCountByTest = new Map<string, number>()
  for (const q of questionsRes.data ?? []) {
    questionCountByTest.set(q.test_id, (questionCountByTest.get(q.test_id) ?? 0) + 1)
  }

  const now = Date.now()
  const cards: CatalogCard[] = tests.map(t => {
    const attempt = attemptsByTest.get(t.id) ?? null
    const total = questionCountByTest.get(t.id) ?? 0
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      unlock_at: t.unlock_at,
      time_limit_minutes: t.time_limit_minutes,
      total_questions: total,
      score: attempt?.score ?? null,
      state: deriveState(t, attempt, now),
    }
  })

  return (
    <TrainerCatalogClient
      fullName={session.fullName}
      classLabel={session.classLabel}
      cards={cards}
    />
  )
}
