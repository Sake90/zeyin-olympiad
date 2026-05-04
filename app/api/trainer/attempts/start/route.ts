import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getTrainerSessionFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getTrainerSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { test_id } = await req.json().catch(() => ({}))
  if (!test_id || typeof test_id !== 'string') {
    return NextResponse.json({ error: 'test_id обязателен' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify the test exists and is unlocked.
  const { data: test, error: testErr } = await db
    .from('trainer_tests')
    .select('id, is_unlocked, unlock_at')
    .eq('id', test_id)
    .single()
  if (testErr || !test) {
    return NextResponse.json({ error: 'Тест не найден' }, { status: 404 })
  }

  const unlocked =
    test.is_unlocked &&
    (test.unlock_at == null || new Date(test.unlock_at).getTime() <= Date.now())
  if (!unlocked) {
    return NextResponse.json({ error: 'Тест ещё не доступен' }, { status: 403 })
  }

  // If an attempt already exists, return it (or 403 if it's already completed).
  const { data: existing } = await db
    .from('trainer_attempts')
    .select('id, status')
    .eq('student_id', session.studentId)
    .eq('test_id', test_id)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'in_progress') {
      return NextResponse.json({ attempt_id: existing.id, status: existing.status })
    }
    return NextResponse.json(
      { error: 'already_completed', attempt_id: existing.id },
      { status: 403 }
    )
  }

  // Fresh attempt. Race with another request: rely on UNIQUE(student_id, test_id).
  const { data: created, error: insertErr } = await db
    .from('trainer_attempts')
    .insert({
      student_id: session.studentId,
      test_id,
      status: 'in_progress',
    })
    .select('id, status')
    .single()

  if (insertErr || !created) {
    // If we lost a race, fall back to reading the existing row.
    const { data: again } = await db
      .from('trainer_attempts')
      .select('id, status')
      .eq('student_id', session.studentId)
      .eq('test_id', test_id)
      .maybeSingle()
    if (again) {
      return NextResponse.json({ attempt_id: again.id, status: again.status })
    }
    return NextResponse.json(
      { error: insertErr?.message ?? 'Не удалось начать тест' },
      { status: 500 }
    )
  }

  return NextResponse.json({ attempt_id: created.id, status: created.status })
}
