import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getTrainerSessionFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getTrainerSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { attempt_id, reason } = await req.json().catch(() => ({}))
  if (typeof attempt_id !== 'string') {
    return NextResponse.json({ error: 'attempt_id обязателен' }, { status: 400 })
  }

  const db = createServiceClient()

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

  const { count: total, error: totalErr } = await db
    .from('trainer_questions')
    .select('id', { count: 'exact', head: true })
    .eq('test_id', attempt.test_id)
  if (totalErr) {
    return NextResponse.json({ error: totalErr.message }, { status: 500 })
  }

  const { count: correct, error: correctErr } = await db
    .from('trainer_answers')
    .select('id', { count: 'exact', head: true })
    .eq('attempt_id', attempt_id)
    .eq('is_correct', true)
  if (correctErr) {
    return NextResponse.json({ error: correctErr.message }, { status: 500 })
  }

  const score = correct ?? 0
  const finalStatus = reason === 'timeout' ? 'auto_submitted' : 'submitted'

  // Race-safe: only update if still in_progress (server auto-submit could have
  // run between the check above and now).
  const { data: updated, error: updateErr } = await db
    .from('trainer_attempts')
    .update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      score,
    })
    .eq('id', attempt_id)
    .eq('status', 'in_progress')
    .select('status')
    .maybeSingle()
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // If the row had already moved to a terminal state, just return its score.
  if (!updated) {
    const { data: now } = await db
      .from('trainer_attempts')
      .select('score, status')
      .eq('id', attempt_id)
      .single()
    return NextResponse.json({
      score: now?.score ?? score,
      total: total ?? 0,
      status: now?.status ?? finalStatus,
    })
  }

  return NextResponse.json({ score, total: total ?? 0, status: finalStatus })
}
