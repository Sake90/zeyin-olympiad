import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateAnalysis } from '@/lib/analysis'
import { buildAnalysisInput, extractBehaviorForPrompt } from '@/lib/analysis-helpers'

export const dynamic = 'force-dynamic'

const STALE_LOCK_MS = 30_000   // 30s — anything older is treated as a hung generator
const RETRY_AFTER_MS = 1500

// GET /api/results/[slug]/analysis
// Lazy generator: first hit triggers Claude call (or fallback) + persist.
// Concurrent hits read the in-flight lock and back off.
export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const slug = decodeURIComponent(ctx.params.slug)
  const db = createServiceClient()

  const { data: result } = await db
    .from('results')
    .select('id, student_id, olympiad_id, score, total_questions, subject_scores, analysis, behavior')
    .eq('slug', slug)
    .single()

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Already generated? Return immediately.
  if (isReady(result.analysis)) {
    return jsonReady(result.analysis)
  }

  // In-flight by another caller? Back off.
  if (isFreshLock(result.analysis)) {
    return NextResponse.json({ ready: false, retry_after_ms: RETRY_AFTER_MS })
  }

  // Acquire the lock and run generation. The lock is best-effort (no row-level
  // transaction), so a tiny race is possible — worst case is one extra Claude
  // call, which is acceptable.
  await db
    .from('results')
    .update({ analysis: { generating: true, started_at: new Date().toISOString() } })
    .eq('id', result.id)

  // Build the input from already-loaded result + side queries (student, math topics).
  const [{ data: student }, { data: questions }, { data: answers }] = await Promise.all([
    db.from('students')
      .select('full_name, grade, language')
      .eq('id', result.student_id)
      .single(),
    db.from('questions')
      .select('id, topic, correct_option')
      .eq('olympiad_id', result.olympiad_id)
      .not('topic', 'is', null),
    db.from('answers')
      .select('question_id, selected_option')
      .eq('student_id', result.student_id),
  ])

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const lang: 'ru' | 'kk' = student.language === 'kz' ? 'kk' : 'ru'
  const input = buildAnalysisInput(result, student, questions ?? [], answers ?? [], lang)
  input.behavior = extractBehaviorForPrompt(result.behavior)

  // generateAnalysis already swallows errors and falls back internally — we
  // don't need our own try/catch around it. But persist failure must not bubble.
  const analysis = await generateAnalysis(input, lang)

  await db
    .from('results')
    .update({ analysis, analysis_generated_at: new Date().toISOString() })
    .eq('id', result.id)

  const res = NextResponse.json({ ready: true, analysis })
  res.headers.set('Cache-Control', 'private, max-age=60')
  return res
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function isReady(a: unknown): a is { observations: unknown[]; source: string; generated_at: string } {
  if (!a || typeof a !== 'object') return false
  const obj = a as Record<string, unknown>
  return Array.isArray(obj.observations) && obj.observations.length === 3
}

function isFreshLock(a: unknown): boolean {
  if (!a || typeof a !== 'object') return false
  const obj = a as Record<string, unknown>
  if (obj.generating !== true) return false
  const startedAt = typeof obj.started_at === 'string' ? Date.parse(obj.started_at) : 0
  return Date.now() - startedAt < STALE_LOCK_MS
}

function jsonReady(analysis: unknown) {
  const res = NextResponse.json({ ready: true, analysis })
  res.headers.set('Cache-Control', 'private, max-age=60')
  return res
}

