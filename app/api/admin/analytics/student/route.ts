import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

// GET /api/admin/analytics/student?student_id=...&olympiad_id=...
export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const studentId = req.nextUrl.searchParams.get('student_id')
  const olympiadId = req.nextUrl.searchParams.get('olympiad_id')
  if (!studentId || !olympiadId) {
    return NextResponse.json({ error: 'student_id and olympiad_id required' }, { status: 400 })
  }

  const db = createServiceClient()

  const [
    { data: student },
    { data: result },
    { data: session },
    { data: questions },
  ] = await Promise.all([
    db.from('students').select('full_name, school, grade, district, language').eq('id', studentId).single(),
    db.from('results').select('score, total_questions, cert_type, passed_to_round2, completed_at, subject_scores').eq('student_id', studentId).eq('olympiad_id', olympiadId).single(),
    db.from('sessions').select('started_at').eq('student_id', studentId).eq('olympiad_id', olympiadId).single(),
    db.from('questions').select('id, order_num, question_ru, question_kz, correct_option, type').eq('olympiad_id', olympiadId).order('order_num'),
  ])

  const questionIds = (questions ?? []).map(q => q.id)
  const { data: answers } = questionIds.length > 0
    ? await db.from('answers').select('question_id, selected_option, answered_at').eq('student_id', studentId).in('question_id', questionIds)
    : { data: [] }

  const answerMap = new Map((answers ?? []).map(a => [a.question_id, a]))
  const startMs = session?.started_at ? new Date(session.started_at).getTime() : null

  const answerList = (questions ?? []).map(q => {
    const a = answerMap.get(q.id)
    const answeredAtMs = a?.answered_at ? new Date(a.answered_at).getTime() : null
    return {
      order_num: q.order_num,
      question_ru: q.question_ru,
      question_kz: q.question_kz,
      type: q.type,
      selected_option: a?.selected_option ?? null,
      correct_option: q.correct_option,
      is_correct: !!a && a.selected_option === q.correct_option,
      time_from_start_ms: startMs && answeredAtMs ? answeredAtMs - startMs : null,
    }
  })

  return NextResponse.json({
    student,
    result,
    started_at: session?.started_at ?? null,
    answers: answerList,
  })
}
