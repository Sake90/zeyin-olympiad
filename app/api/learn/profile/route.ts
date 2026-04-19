import { NextRequest, NextResponse } from 'next/server'
import {
  getStudentSessionFromRequest,
  setStudentCookieHeader,
  signStudentToken,
} from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: student } = await db
    .from('students')
    .select('id, full_name, school, grade, language, login, olympiad_id')
    .eq('id', session.studentId)
    .maybeSingle()
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { count: completedCount } = await db
    .from('student_progress')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', session.studentId)
    .eq('status', 'completed')

  return NextResponse.json({ student, completedCount: completedCount ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { language?: 'ru' | 'kz' } | null
  if (!body?.language || (body.language !== 'ru' && body.language !== 'kz')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('students')
    .update({ language: body.language })
    .eq('id', session.studentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const newToken = await signStudentToken({
    studentId: session.studentId,
    olympiadId: session.olympiadId,
    language: body.language,
  })

  const res = NextResponse.json({ ok: true, language: body.language })
  res.headers.set('Set-Cookie', setStudentCookieHeader(newToken))
  return res
}

export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.headers.set(
    'Set-Cookie',
    `zeyin_student=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  )
  return res
}
