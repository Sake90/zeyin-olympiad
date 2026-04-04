import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

// GET — get result for current student
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createServiceClient()

    const { data: result, error } = await db
      .from('results')
      .select('*')
      .eq('student_id', session.studentId)
      .eq('olympiad_id', session.olympiadId)
      .single()

    if (error || !result) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 })
    }

    // Also get student info and olympiad name for display
    const [{ data: student }, { data: olympiad }] = await Promise.all([
      db.from('students').select('full_name, grade, school, language').eq('id', session.studentId).single(),
      db.from('olympiads').select('name_ru, name_kz, outro_video_url').eq('id', session.olympiadId).single(),
    ])

    return NextResponse.json({ ...result, student, olympiad, language: session.language })
  } catch (e) {
    console.error('GET /api/quiz/result error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
