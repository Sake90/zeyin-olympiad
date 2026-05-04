import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getTrainerSessionFromRequest } from '@/lib/auth'

const VALID_OPTIONS = new Set(['A', 'B', 'C', 'D'])

export async function POST(req: NextRequest) {
  const session = await getTrainerSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { attempt_id, question_id, selected_option } = await req
    .json()
    .catch(() => ({}))

  if (
    typeof attempt_id !== 'string' ||
    typeof question_id !== 'string' ||
    typeof selected_option !== 'string' ||
    !VALID_OPTIONS.has(selected_option)
  ) {
    return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify attempt belongs to current student and is still in progress.
  const { data: attempt, error: attemptErr } = await db
    .from('trainer_attempts')
    .select('id, student_id, test_id, status')
    .eq('id', attempt_id)
    .single()
  if (attemptErr || !attempt) {
    return NextResponse.json({ error: 'Попытка не найдена' }, { status: 404 })
  }
  if (attempt.student_id !== session.studentId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (attempt.status !== 'in_progress') {
    return NextResponse.json({ error: 'Тест уже завершён' }, { status: 409 })
  }

  // Verify the question belongs to this test (prevent cross-test answer injection).
  const { data: question, error: qErr } = await db
    .from('trainer_questions')
    .select('id, test_id, correct_option')
    .eq('id', question_id)
    .single()
  if (qErr || !question) {
    return NextResponse.json({ error: 'Вопрос не найден' }, { status: 404 })
  }
  if (question.test_id !== attempt.test_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isCorrect = selected_option === question.correct_option

  const { error: upsertErr } = await db
    .from('trainer_answers')
    .upsert(
      {
        attempt_id,
        question_id,
        selected_option,
        is_correct: isCorrect,
      },
      { onConflict: 'attempt_id,question_id' }
    )
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  // NOTE: deliberately do NOT return is_correct — students must not see
  // correctness while taking the test.
  return NextResponse.json({ ok: true })
}
