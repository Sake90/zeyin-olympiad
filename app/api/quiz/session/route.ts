import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// GET — get current state (olympiad + session if exists + answers + questions)
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceClient()

    const { data: olympiad, error: oErr } = await db
      .from('olympiads')
      .select('id, name_ru, name_kz, subject, start_time, duration_minutes, status, intro_video_url, intro_text_ru, intro_text_kz, cert_range_winner_min, cert_range_prize_min, cert_range_pass_min')
      .eq('id', session.olympiadId)
      .single()

    if (oErr || !olympiad) {
      return NextResponse.json({ error: 'Olympiad not found' }, { status: 404 })
    }

    // Check if session exists
    const { data: quizSession } = await db
      .from('sessions')
      .select('*')
      .eq('student_id', session.studentId)
      .eq('olympiad_id', session.olympiadId)
      .single()

    if (!quizSession) {
      return NextResponse.json({ olympiad, session: null, questions: [], answers: [], language: session.language })
    }

    // Fetch questions and answers in parallel
    const [{ data: questions }, { data: answers }] = await Promise.all([
      db.from('questions')
        .select('id, type, question_ru, question_kz, option_a_ru, option_b_ru, option_c_ru, option_d_ru, option_a_kz, option_b_kz, option_c_kz, option_d_kz, youtube_url_ru, youtube_url_kz, order_num')
        .eq('olympiad_id', session.olympiadId)
        .order('order_num'),
      db.from('answers')
        .select('question_id, selected_option')
        .eq('student_id', session.studentId),
    ])

    return NextResponse.json({
      olympiad,
      session: quizSession,
      questions: questions ?? [],
      answers: answers ?? [],
      language: session.language,
    })
  } catch (e) {
    console.error('GET /api/quiz/session error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — start quiz (create session)
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceClient()

    const { data: olympiad } = await db
      .from('olympiads')
      .select('id, name_ru, name_kz, duration_minutes, status, cert_range_winner_min, cert_range_prize_min, cert_range_pass_min')
      .eq('id', session.olympiadId)
      .single()

    if (!olympiad) return NextResponse.json({ error: 'Olympiad not found' }, { status: 404 })
    if (olympiad.status !== 'active') {
      return NextResponse.json({ error: 'Olympiad is not active', status: olympiad.status }, { status: 403 })
    }

    // Check if session already exists
    const { data: existing } = await db
      .from('sessions')
      .select('*')
      .eq('student_id', session.studentId)
      .eq('olympiad_id', session.olympiadId)
      .single()

    if (existing) {
      // Return existing session — fetch questions and answers in parallel
      const [{ data: questions }, { data: answers }] = await Promise.all([
        db.from('questions')
          .select('id, type, question_ru, question_kz, option_a_ru, option_b_ru, option_c_ru, option_d_ru, option_a_kz, option_b_kz, option_c_kz, option_d_kz, youtube_url_ru, youtube_url_kz, order_num')
          .eq('olympiad_id', session.olympiadId)
          .order('order_num'),
        db.from('answers')
          .select('question_id, selected_option')
          .eq('student_id', session.studentId),
      ])

      return NextResponse.json({ session: existing, questions: questions ?? [], answers: answers ?? [], language: session.language })
    }

    // Create new session
    const { data: newSession, error: sErr } = await db
      .from('sessions')
      .insert({
        student_id: session.studentId,
        olympiad_id: session.olympiadId,
        started_at: new Date().toISOString(),
        time_remaining_seconds: olympiad.duration_minutes * 60,
        last_question_num: 1,
        is_completed: false,
      })
      .select()
      .single()

    if (sErr || !newSession) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    const { data: questions } = await db
      .from('questions')
      .select('id, type, question_ru, question_kz, option_a_ru, option_b_ru, option_c_ru, option_d_ru, option_a_kz, option_b_kz, option_c_kz, option_d_kz, youtube_url_ru, youtube_url_kz, order_num')
      .eq('olympiad_id', session.olympiadId)
      .order('order_num')

    return NextResponse.json({ session: newSession, questions: questions ?? [], answers: [], language: session.language })
  } catch (e) {
    console.error('POST /api/quiz/session error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
