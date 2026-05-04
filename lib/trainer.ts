import { createServiceClient } from '@/lib/supabase'

export type TrainerAttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted'

export interface TrainerTest {
  id: string
  title: string
  description: string | null
  order_index: number
  unlock_at: string | null
  is_unlocked: boolean
  time_limit_minutes: number | null
  created_at: string
}

export interface TrainerAttempt {
  id: string
  student_id: string
  test_id: string
  started_at: string
  finished_at: string | null
  score: number | null
  status: TrainerAttemptStatus
}

export interface TrainerQuestion {
  id: string
  test_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  explanation: string | null
  order_index: number
}

export type TrainerOption = 'A' | 'B' | 'C' | 'D'

export const HARD_RESUME_LIMIT_HOURS = 24

/**
 * If the in-progress attempt has timed out (test time limit exceeded, or
 * 24h hard cap from started_at), score it and mark as auto_submitted.
 * Returns the resulting status. Caller decides where to redirect.
 *
 * Idempotent: if status is already terminal, returns it unchanged.
 */
export async function autoSubmitIfExpired(params: {
  attemptId: string
  testTimeLimitMinutes: number | null
  startedAt: string
  currentStatus: TrainerAttemptStatus
}): Promise<TrainerAttemptStatus> {
  const { attemptId, testTimeLimitMinutes, startedAt, currentStatus } = params
  if (currentStatus !== 'in_progress') return currentStatus

  const startedMs = new Date(startedAt).getTime()
  const elapsedMs = Date.now() - startedMs
  const limitMs = testTimeLimitMinutes != null
    ? testTimeLimitMinutes * 60 * 1000
    : Infinity
  const hardCapMs = HARD_RESUME_LIMIT_HOURS * 60 * 60 * 1000

  const expiredByLimit  = elapsedMs >= limitMs
  const expiredByHardCap = elapsedMs >= hardCapMs
  if (!expiredByLimit && !expiredByHardCap) return currentStatus

  const db = createServiceClient()
  const { count, error } = await db
    .from('trainer_answers')
    .select('id', { count: 'exact', head: true })
    .eq('attempt_id', attemptId)
    .eq('is_correct', true)
  if (error) throw error

  await db
    .from('trainer_attempts')
    .update({
      status: 'auto_submitted',
      finished_at: new Date().toISOString(),
      score: count ?? 0,
    })
    .eq('id', attemptId)
    .eq('status', 'in_progress') // race-safe: only update if still in progress

  return 'auto_submitted'
}

/**
 * Index (0-based) of the first question that has no saved answer.
 * Returns 0 if all are unanswered, returns last index if all are answered.
 */
export function firstUnansweredIndex(
  questions: Array<{ id: string }>,
  answers: Array<{ question_id: string }>
): number {
  const answered = new Set(answers.map(a => a.question_id))
  for (let i = 0; i < questions.length; i++) {
    if (!answered.has(questions[i].id)) return i
  }
  return Math.max(0, questions.length - 1)
}
