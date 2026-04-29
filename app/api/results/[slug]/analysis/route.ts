import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateAnalysis } from '@/lib/analysis'
import type { AnalysisInput } from '@/lib/analysis-prompt'

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

interface ResultRow {
  id: string
  score: number
  total_questions: number
  subject_scores: unknown
  behavior?: unknown
}

// Only pass through fully-shaped behavior; insufficient_data / calc_failed
// markers become null so the prompt formatter renders "no data" cleanly.
export function extractBehaviorForPrompt(
  raw: unknown,
): AnalysisInput['behavior'] {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  if (b.insufficient_data === true || b.error === 'calc_failed') return null
  if (
    typeof b.speed_label === 'string' &&
    typeof b.confidence_label === 'string' &&
    typeof b.error_pattern === 'string' &&
    typeof b.avg_seconds_per_question === 'number'
  ) {
    return {
      speed_label: b.speed_label as 'fast' | 'normal' | 'slow',
      confidence_label: b.confidence_label as 'high' | 'medium' | 'low',
      error_pattern: b.error_pattern as 'weak_start' | 'weak_end' | 'consistent',
      avg_seconds: b.avg_seconds_per_question,
    }
  }
  return null
}
interface StudentRow {
  full_name: string
  grade: string | null
  language: string | null
}
interface QuestionRow { id: string; topic: string | null; correct_option: string }
interface AnswerRow   { question_id: string; selected_option: string | null }

export function buildAnalysisInput(
  result: ResultRow,
  student: StudentRow,
  questions: QuestionRow[],
  answers: AnswerRow[],
  lang: 'ru' | 'kk',
): AnalysisInput {
  const total = result.total_questions ?? 0
  const accuracy = total > 0 ? Math.round((result.score / total) * 100) : 0

  // Subjects: collapse jsonb array into the prompt's flat shape.
  const subjectScoresRaw = Array.isArray(result.subject_scores) ? result.subject_scores : []
  const subjects = subjectScoresRaw.map((s: { name_ru: string; name_kz: string; score: number; total: number }) => ({
    name: lang === 'kk' ? s.name_kz : s.name_ru,
    score: s.score,
    total: s.total,
  }))

  // Math topics: re-aggregate from answers + questions (same logic as the page).
  const answersByQ = new Map(answers.map(a => [a.question_id, a.selected_option]))
  const topicAgg = new Map<string, { correct: number; total: number }>()
  for (const q of questions) {
    if (!q.topic) continue
    const cur = topicAgg.get(q.topic) ?? { correct: 0, total: 0 }
    cur.total += 1
    if (answersByQ.get(q.id) === q.correct_option) cur.correct += 1
    topicAgg.set(q.topic, cur)
  }
  const mathTopics = Array.from(topicAgg.entries()).map(([name, v]) => ({
    name,
    percent: v.total > 0 ? (v.correct / v.total) * 100 : 0,
  }))

  // Grade is stored as text — best-effort numeric parse, default 5 if unknown.
  const grade = Number.parseInt(student.grade ?? '', 10)

  return {
    full_name: student.full_name,
    grade: Number.isFinite(grade) ? grade : 5,
    language: lang,
    score: result.score,
    total_questions: total,
    accuracy_percent: accuracy,
    subject_scores: subjects,
    math_topics: mathTopics,
    behavior: null,   // Behavior is out of scope for the prompt — keep deterministic.
  }
}
