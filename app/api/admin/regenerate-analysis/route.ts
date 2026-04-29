import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { generateAnalysis } from '@/lib/analysis'
import { buildAnalysisInput, extractBehaviorForPrompt } from '../../results/[slug]/analysis/route'

// POST /api/admin/regenerate-analysis
// Body: { result_id?: string } | { olympiad_id?: string }
// Force-regenerates analysis for one result or every result of an olympiad.
// Bypasses the in-flight lock used by the public lazy endpoint.
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

  let resultRows: Array<{
    id: string
    student_id: string
    olympiad_id: string
    score: number
    total_questions: number
    subject_scores: unknown
    behavior?: unknown
  }> = []

  if (body.result_id) {
    const { data, error } = await db
      .from('results')
      .select('id, student_id, olympiad_id, score, total_questions, subject_scores, behavior')
      .eq('id', body.result_id)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    resultRows = [data]
  } else {
    const { data, error } = await db
      .from('results')
      .select('id, student_id, olympiad_id, score, total_questions, subject_scores, behavior')
      .eq('olympiad_id', body.olympiad_id!)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    resultRows = data ?? []
  }

  if (resultRows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, errors: [], costs_estimate: null })
  }

  // Side data: students + math questions for every olympiad we touch.
  const studentIds = Array.from(new Set(resultRows.map(r => r.student_id)))
  const olympiadIds = Array.from(new Set(resultRows.map(r => r.olympiad_id)))

  const [{ data: students }, { data: questions }, { data: answers }] = await Promise.all([
    db.from('students').select('id, full_name, grade, language').in('id', studentIds),
    db.from('questions').select('id, olympiad_id, topic, correct_option').in('olympiad_id', olympiadIds).not('topic', 'is', null),
    db.from('answers').select('student_id, question_id, selected_option').in('student_id', studentIds),
  ])

  const studentMap = new Map((students ?? []).map(s => [s.id, s]))
  const qByOlymp = new Map<string, typeof questions>()
  for (const q of questions ?? []) {
    const arr = qByOlymp.get(q.olympiad_id) ?? []
    arr!.push(q)
    qByOlymp.set(q.olympiad_id, arr)
  }
  const aByStudent = new Map<string, Array<{ question_id: string; selected_option: string | null }>>()
  for (const a of answers ?? []) {
    const arr = aByStudent.get(a.student_id) ?? []
    arr.push({ question_id: a.question_id, selected_option: a.selected_option })
    aByStudent.set(a.student_id, arr)
  }

  let processed = 0
  const errors: Array<{ result_id: string; reason: string }> = []
  let claudeCalls = 0   // for the cost estimate — fallbacks don't hit the API

  for (const r of resultRows) {
    const student = studentMap.get(r.student_id)
    if (!student) {
      errors.push({ result_id: r.id, reason: 'student missing' })
      continue
    }
    const lang: 'ru' | 'kk' = student.language === 'kz' ? 'kk' : 'ru'
    const input = buildAnalysisInput(
      r,
      student,
      qByOlymp.get(r.olympiad_id) ?? [],
      aByStudent.get(r.student_id) ?? [],
      lang,
    )
    input.behavior = extractBehaviorForPrompt(r.behavior)

    try {
      const analysis = await generateAnalysis(input, lang)
      if (analysis.source === 'claude') claudeCalls += 1
      const { error: uErr } = await db
        .from('results')
        .update({ analysis, analysis_generated_at: new Date().toISOString() })
        .eq('id', r.id)
      if (uErr) {
        errors.push({ result_id: r.id, reason: uErr.message })
        continue
      }
      processed += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ result_id: r.id, reason: msg })
    }
  }

  // Rough cost estimate — Sonnet 4.6 input ~$3/1M, output ~$15/1M.
  // Each call: ~700 prompt tokens + ~250 output tokens ≈ $0.006 per result.
  const costsEstimate = {
    claude_calls: claudeCalls,
    approx_usd: Math.round(claudeCalls * 0.006 * 1000) / 1000,
  }

  return NextResponse.json({ ok: true, processed, errors, costs_estimate: costsEstimate })
}
