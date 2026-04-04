import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

// GET /api/admin/analytics?olympiad_id=...
export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const olympiadId = req.nextUrl.searchParams.get('olympiad_id')
  if (!olympiadId) return NextResponse.json({ error: 'olympiad_id required' }, { status: 400 })

  const db = createServiceClient()

  const [
    { data: questions },
    { data: results },
    { data: sessions },
    { data: olympiad },
  ] = await Promise.all([
    db.from('questions').select('id, order_num, question_ru, question_kz, correct_option').eq('olympiad_id', olympiadId).order('order_num'),
    db.from('results').select('student_id, score, total_questions, passed_to_round2, completed_at').eq('olympiad_id', olympiadId),
    db.from('sessions').select('student_id, started_at').eq('olympiad_id', olympiadId).eq('is_completed', true),
    db.from('olympiads').select('subjects').eq('id', olympiadId).single(),
  ])

  const studentIds = (results ?? []).map(r => r.student_id)
  const questionIds = (questions ?? []).map(q => q.id)

  let answers: { student_id: string; question_id: string; selected_option: string; answered_at: string }[] = []
  if (studentIds.length > 0 && questionIds.length > 0) {
    const { data } = await db
      .from('answers')
      .select('student_id, question_id, selected_option, answered_at')
      .in('student_id', studentIds)
      .in('question_id', questionIds)
    answers = data ?? []
  }

  // Summary
  const total = results?.length ?? 0
  const passed = (results ?? []).filter(r => r.passed_to_round2).length
  const avgScore = total > 0 ? (results ?? []).reduce((s, r) => s + r.score, 0) / total : 0
  const avgPct = total > 0 ? (results ?? []).reduce((s, r) => s + (r.score / Math.max(r.total_questions, 1)) * 100, 0) / total : 0

  const sessionMap = new Map((sessions ?? []).map(s => [s.student_id, s.started_at]))
  let totalTimeMs = 0, timeCount = 0
  for (const r of results ?? []) {
    const startedAt = sessionMap.get(r.student_id)
    if (startedAt && r.completed_at) {
      const ms = new Date(r.completed_at).getTime() - new Date(startedAt).getTime()
      if (ms > 0 && ms < 4 * 60 * 60 * 1000) { totalTimeMs += ms; timeCount++ }
    }
  }

  // Question stats
  const questionStats = (questions ?? []).map(q => {
    const qAnswers = answers.filter(a => a.question_id === q.id)
    const correctCount = qAnswers.filter(a => a.selected_option === q.correct_option).length
    const optionCounts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 }
    for (const a of qAnswers) {
      const opt = a.selected_option?.toLowerCase()
      if (opt in optionCounts) optionCounts[opt]++
    }
    return {
      question_id: q.id,
      order_num: q.order_num,
      question_ru: q.question_ru,
      question_kz: q.question_kz,
      correct_option: q.correct_option,
      total_answers: qAnswers.length,
      correct_count: correctCount,
      option_counts: optionCounts,
    }
  })

  return NextResponse.json({
    summary: {
      total,
      passed,
      avg_score: Math.round(avgScore * 10) / 10,
      avg_pct: Math.round(avgPct * 10) / 10,
      avg_time_ms: timeCount > 0 ? Math.round(totalTimeMs / timeCount) : null,
    },
    question_stats: questionStats,
    subjects: olympiad?.subjects ?? [],
  })
}
