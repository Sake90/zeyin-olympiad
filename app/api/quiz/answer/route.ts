import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// POST — save or update an answer
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { question_id, selected_option } = await req.json()
    if (!question_id || !selected_option) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = createServiceClient()

    // Upsert answer directly — JWT auth is sufficient, UNIQUE(student_id,question_id) guards integrity
    const { error } = await db
      .from('answers')
      .upsert(
        {
          student_id: session.studentId,
          question_id,
          selected_option,
          answered_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,question_id' }
      )

    if (error) {
      console.error('Upsert answer error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/quiz/answer error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
