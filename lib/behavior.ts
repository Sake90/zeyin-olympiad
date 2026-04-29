import { createServiceClient } from './supabase'

// Persisted shape for results.behavior. Mirrored as nullable in Result type.
export interface BehaviorData {
  avg_seconds_per_question: number
  median_seconds_per_question: number
  speed_label: 'fast' | 'normal' | 'slow'
  confidence_label: 'low' | 'medium' | 'high'
  error_pattern: 'weak_start' | 'weak_end' | 'consistent'
  total_questions: number
  calculated_at: string
}

export interface BehaviorErrorMarker { error: 'calc_failed' }

// Emitted instead of full BehaviorData when the student answered fewer than
// MIN_ANSWERS questions — the dataset is too small for averages/variance to
// be meaningful, and it would be cruel to label an abandoned attempt anyway.
export interface BehaviorInsufficient {
  insufficient_data: true
  total_answered: number
  calculated_at: string
}

const MIN_ANSWERS = 15

// Outliers above this threshold (10 minutes on a single question) are clearly
// "child stepped away" rather than thinking time — replace with the dataset's
// median so they don't dominate the mean / std calculations.
const OUTLIER_SECONDS = 600

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

function stdDev(xs: number[], avg: number): number {
  if (xs.length === 0) return 0
  let s = 0
  for (const x of xs) s += (x - avg) ** 2
  return Math.sqrt(s / xs.length)
}

export async function calculateBehavior(
  studentId: string,
  resultId: string,
  startedAt: string,
  completedAt: string,
  score: number,
  totalQuestions: number,
): Promise<BehaviorData | BehaviorInsufficient> {
  const db = createServiceClient()

  // Need olympiad_id of THIS result to scope answers (a student may have
  // results for multiple olympiads — without scoping, prior answers leak in).
  const { data: result, error: rErr } = await db
    .from('results')
    .select('olympiad_id')
    .eq('id', resultId)
    .single()
  if (rErr || !result) throw new Error(`result ${resultId} not found`)

  const [{ data: questions }, { data: answers }] = await Promise.all([
    db.from('questions')
      .select('id, correct_option, order_num')
      .eq('olympiad_id', result.olympiad_id),
    db.from('answers')
      .select('question_id, selected_option, answered_at')
      .eq('student_id', studentId)
      .order('answered_at', { ascending: true }),
  ])

  const qMap = new Map((questions ?? []).map(q => [q.id, q]))
  // Drop any answers for questions outside this olympiad.
  const filtered = (answers ?? []).filter(a => qMap.has(a.question_id))

  // Abandoned attempt: too few datapoints for meaningful avg/std/coef.
  // Bail out with a marker so the UI shows a neutral plate.
  if (filtered.length < MIN_ANSWERS) {
    return {
      insufficient_data: true,
      total_answered: filtered.length,
      calculated_at: new Date().toISOString(),
    }
  }
  void completedAt

  // Time-per-question: gap between consecutive answer timestamps. The first
  // gap is from startedAt (session start) to the first answered_at.
  const startMs = new Date(startedAt).getTime()
  let prevMs = startMs
  const rawTimes: number[] = []
  for (const a of filtered) {
    const t = new Date(a.answered_at).getTime()
    const sec = Math.max(0, (t - prevMs) / 1000)
    rawTimes.push(sec)
    prevMs = t
  }

  // Replace outliers with the raw-data median (computed BEFORE replacement so
  // the median itself isn't skewed by outliers).
  const medRaw = median(rawTimes)
  const corrected = rawTimes.map(s => (s > OUTLIER_SECONDS ? medRaw : s))

  const avg = mean(corrected)
  const med = median(corrected)
  const std = stdDev(corrected, avg)
  const coef = avg > 0 ? std / avg : 0

  // Speed — thresholds tuned for the 90-minute / 35-question olympiad format.
  // fast<25 (not 30): top scorers tend to land at avg 26-29s solving efficiently,
  // not by tapping; calling them "Очень быстро — будь внимательнее" is wrong.
  let speed_label: BehaviorData['speed_label'] = 'normal'
  if (avg < 25) speed_label = 'fast'
  else if (avg > 110) speed_label = 'slow'

  // Confidence — accuracy beats raw rhythm variance.
  // A top student naturally has high coef_variation (easy q in 5s, hard q in
  // 60s) — judging confidence on variance alone falsely marks them as "low".
  // Priority order:
  //   1. Top scorer with non-trivial avg → "high" regardless of variance.
  //   2. Fast + low accuracy → "low" (clearly tapping).
  //   3. Otherwise fall back to variance/accuracy thresholds.
  const accuracy = totalQuestions > 0 ? score / totalQuestions : 0
  let confidence_label: BehaviorData['confidence_label']
  if (accuracy >= 0.85 && avg >= 15) {
    confidence_label = 'high'
  } else if (avg < 15 && accuracy < 0.5) {
    confidence_label = 'low'
  } else if (coef > 1.0 && accuracy < 0.6) {
    confidence_label = 'low'
  } else if (coef < 0.5 && accuracy >= 0.6) {
    confidence_label = 'high'
  } else {
    confidence_label = 'medium'
  }

  // Error pattern: split by question position (first half = 1-17, second = 18-35
  // for a 35-question olympiad; halves still split sensibly for other sizes).
  let firstTotal = 0, firstWrong = 0
  let secondTotal = 0, secondWrong = 0
  for (const a of filtered) {
    const q = qMap.get(a.question_id)
    if (!q) continue
    const isWrong = a.selected_option !== q.correct_option
    if ((q.order_num ?? 0) <= 17) {
      firstTotal += 1
      if (isWrong) firstWrong += 1
    } else {
      secondTotal += 1
      if (isWrong) secondWrong += 1
    }
  }
  const errFirst = firstTotal > 0 ? (firstWrong / firstTotal) * 100 : 0
  const errSecond = secondTotal > 0 ? (secondWrong / secondTotal) * 100 : 0

  let error_pattern: BehaviorData['error_pattern'] = 'consistent'
  if (errFirst - errSecond > 20) error_pattern = 'weak_start'
  else if (errSecond - errFirst > 20) error_pattern = 'weak_end'

  return {
    avg_seconds_per_question: Math.round(avg),
    median_seconds_per_question: Math.round(med),
    speed_label,
    confidence_label,
    error_pattern,
    total_questions: filtered.length,
    calculated_at: new Date().toISOString(),
  }
}
