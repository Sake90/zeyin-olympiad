import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { calculateBehavior } from '@/lib/behavior'

// POST /api/admin/recalc-behavior
// Body: { result_id?: string } | { olympiad_id?: string }
// Recomputes behavior for one result or every result of an olympiad.
// Used to backfill rows from before the behavior block existed.
export async function POST(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { result_id?: string; olympiad_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.result_id && !body.olympiad_id) {
    return NextResponse.json(
      { error: 'Provide result_id or olympiad_id' },
      { status: 400 },
    )
  }

  const db = createServiceClient()

  // Resolve target result rows.
  let resultRows: Array<{
    id: string
    student_id: string
    olympiad_id: string
    completed_at: string | null
    score: number
    total_questions: number
  }> = []
  if (body.result_id) {
    const { data, error } = await db
      .from('results')
      .select('id, student_id, olympiad_id, completed_at, score, total_questions')
      .eq('id', body.result_id)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    resultRows = [data]
  } else {
    const { data, error } = await db
      .from('results')
      .select('id, student_id, olympiad_id, completed_at, score, total_questions')
      .eq('olympiad_id', body.olympiad_id!)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    resultRows = data ?? []
  }

  if (resultRows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, errors: [] })
  }

  // started_at lives on sessions, not results. Fetch all relevant sessions in
  // a single query, then loop. (This is admin-only, so the latency is fine.)
  const studentIds = Array.from(new Set(resultRows.map(r => r.student_id)))
  const olympiadIds = Array.from(new Set(resultRows.map(r => r.olympiad_id)))
  const { data: sessions } = await db
    .from('sessions')
    .select('student_id, olympiad_id, started_at')
    .in('student_id', studentIds)
    .in('olympiad_id', olympiadIds)

  const sessionKey = (sid: string, oid: string) => `${sid}|${oid}`
  const sessionMap = new Map<string, string | null>()
  for (const s of sessions ?? []) {
    sessionMap.set(sessionKey(s.student_id, s.olympiad_id), s.started_at)
  }

  let processed = 0
  const errors: Array<{ result_id: string; reason: string }> = []

  for (const r of resultRows) {
    const startedAt = sessionMap.get(sessionKey(r.student_id, r.olympiad_id))
    if (!startedAt) {
      errors.push({ result_id: r.id, reason: 'no session.started_at' })
      await db.from('results').update({ behavior: { error: 'calc_failed' } }).eq('id', r.id)
      continue
    }
    try {
      const behavior = await calculateBehavior(
        r.student_id,
        r.id,
        startedAt,
        r.completed_at ?? new Date().toISOString(),
        r.score,
        r.total_questions,
      )
      const { error: uErr } = await db.from('results').update({ behavior }).eq('id', r.id)
      if (uErr) {
        errors.push({ result_id: r.id, reason: uErr.message })
        continue
      }
      processed += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ result_id: r.id, reason: msg })
      await db.from('results').update({ behavior: { error: 'calc_failed' } }).eq('id', r.id)
    }
  }

  return NextResponse.json({ ok: true, processed, errors })
}
