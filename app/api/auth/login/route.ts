import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase'
import { signStudentToken, setStudentCookieHeader } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { login, password } = await req.json()

  if (!login || !password) {
    return NextResponse.json({ error: 'Введите логин и пароль' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: student, error } = await db
    .from('students')
    .select('id, login, password_hash, olympiad_id, language')
    .eq('login', login.trim().toLowerCase())
    .single()

  if (error || !student) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, student.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  const token = await signStudentToken({
    studentId: student.id,
    olympiadId: student.olympiad_id ?? '',
    language: student.language,
  })

  const res = NextResponse.json({ ok: true, language: student.language })
  res.headers.set('Set-Cookie', setStudentCookieHeader(token))
  return res
}
