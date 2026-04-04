import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// POST — finish quiz, calculate score, save result
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceClient()

    // Verify active session
    const { data: quizSession } = await db
      .from('sessions')
      .select('id, is_completed, olympiad_id')
      .eq('student_id', session.studentId)
      .eq('olympiad_id', session.olympiadId)
      .single()

    if (!quizSession) return NextResponse.json({ error: 'No session' }, { status: 404 })

    // If already completed, just return existing result
    if (quizSession.is_completed) {
      const { data: existing } = await db
        .from('results')
        .select('*')
        .eq('student_id', session.studentId)
        .eq('olympiad_id', session.olympiadId)
        .single()
      if (existing) return NextResponse.json(existing)
    }

    // Get olympiad cert ranges + subjects
    const { data: olympiad } = await db
      .from('olympiads')
      .select('cert_range_winner_min, cert_range_prize_min, cert_range_pass_min, subjects')
      .eq('id', session.olympiadId)
      .single()

    if (!olympiad) return NextResponse.json({ error: 'Olympiad not found' }, { status: 404 })

    // Get all questions with correct answers + order
    const { data: questions } = await db
      .from('questions')
      .select('id, correct_option, order_num')
      .eq('olympiad_id', session.olympiadId)

    // Get student answers
    const { data: answers } = await db
      .from('answers')
      .select('question_id, selected_option')
      .eq('student_id', session.studentId)

    const total = (questions ?? []).length
    const answerMap = new Map((answers ?? []).map(a => [a.question_id, a.selected_option]))

    let score = 0
    for (const q of questions ?? []) {
      if (answerMap.get(q.id) === q.correct_option) score++
    }

    // Compute per-subject scores
    type SubjectDef = { name_ru: string; name_kz: string; from_q: number; to_q: number }
    const subjectDefs = ((olympiad as any).subjects ?? []) as SubjectDef[]
    const subjectScores = subjectDefs.map(s => {
      const sub = (questions ?? []).filter(q => q.order_num >= s.from_q && q.order_num <= s.to_q)
      return {
        name_ru: s.name_ru,
        name_kz: s.name_kz,
        score: sub.filter(q => answerMap.get(q.id) === q.correct_option).length,
        total: sub.length,
      }
    })

    // Calculate cert type
    const pct = total > 0 ? (score / total) * 100 : 0
    let certType: 'winner' | 'prize' | 'participant' = 'participant'
    let passedToRound2 = false

    if (pct >= olympiad.cert_range_winner_min) {
      certType = 'winner'
      passedToRound2 = true
    } else if (pct >= olympiad.cert_range_prize_min) {
      certType = 'prize'
      passedToRound2 = true
    }

    // Save result
    const { data: result, error: rErr } = await db
      .from('results')
      .upsert(
        {
          student_id: session.studentId,
          olympiad_id: session.olympiadId,
          score,
          total_questions: total,
          cert_type: certType,
          passed_to_round2: passedToRound2,
          completed_at: new Date().toISOString(),
          subject_scores: subjectScores,
        },
        { onConflict: 'student_id,olympiad_id' }
      )
      .select()
      .single()

    if (rErr) {
      console.error('Save result error:', rErr)
      return NextResponse.json({ error: rErr.message }, { status: 500 })
    }

    // Mark session as completed
    await db
      .from('sessions')
      .update({ is_completed: true })
      .eq('id', quizSession.id)

    return NextResponse.json(result)
  } catch (e) {
    console.error('POST /api/quiz/finish error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
