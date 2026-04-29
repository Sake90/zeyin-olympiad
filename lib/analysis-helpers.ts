import type { AnalysisInput } from './analysis-prompt'

interface ResultRow {
  id: string
  score: number
  total_questions: number
  subject_scores: unknown
  behavior?: unknown
}

interface StudentRow {
  full_name: string
  grade: string | null
  language: string | null
}

interface QuestionRow { id: string; topic: string | null; correct_option: string }
interface AnswerRow   { question_id: string; selected_option: string | null }

// Only pass through fully-shaped behavior; insufficient_data / calc_failed
// markers become null so the prompt formatter renders "no data" cleanly.
export function extractBehaviorForPrompt(raw: unknown): AnalysisInput['behavior'] {
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
