import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase'
import { signTrainerToken, setTrainerCookieHeader, clearTrainerCookieHeader } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { login, password } = await req.json()

  if (!login || !password) {
    return NextResponse.json({ error: 'Введите логин и пароль' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: student, error } = await db
    .from('trainer_students')
    .select('id, full_name, class_label, password_hash')
    .eq('login', String(login).trim().toLowerCase())
    .single()

  if (error || !student) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, student.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Неверный логин или пароль' }, { status: 401 })
  }

  const token = await signTrainerToken({
    studentId: student.id,
    fullName: student.full_name,
    classLabel: student.class_label,
  })

  const res = NextResponse.json({ ok: true, fullName: student.full_name })
  res.headers.set('Set-Cookie', setTrainerCookieHeader(token))
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', clearTrainerCookieHeader())
  return res
}
