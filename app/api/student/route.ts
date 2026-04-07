// WhatsApp bot endpoints:
// GET  /api/student?phone=77XXXXXXXXX        — find student by phone
// POST /api/student { full_name, grade, ... } — register student, auto-assign olympiad
// Auth: x-api-key header must match BOT_API_KEY env var

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase'
import { generateUniqueLogin, generatePassword } from '@/lib/login-gen'

export async function GET(req: NextRequest) {
  // Verify bot API key
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.BOT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const phone = req.nextUrl.searchParams.get('phone')?.replace(/\D/g, '')
  if (!phone) {
    return NextResponse.json({ error: 'phone param required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Try exact match, then with leading 7 vs 8
  const variants = [phone]
  if (phone.startsWith('8')) variants.push('7' + phone.slice(1))
  if (phone.startsWith('7')) variants.push('8' + phone.slice(1))

  const { data: students, error } = await db
    .from('students')
    .select('id, full_name, login, password_plain, olympiad_id, language, olympiads(status)')
    .in('whatsapp', variants)
    .limit(1)

  if (error || !students || students.length === 0) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  const s = students[0] as typeof students[0] & { olympiads: { status: string } | null }

  return NextResponse.json({
    login: s.login,
    password: s.password_plain,
    full_name: s.full_name,
    olympiad_id: s.olympiad_id,
    language: s.language,
    olympiad_status: s.olympiads?.status ?? null,
  })
}

// POST /api/student — register new student via WhatsApp bot
// Finds olympiad with status='registration' matching student's grade
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.BOT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { full_name, school, grade, district, language, whatsapp } = body

  if (!full_name || !grade || !whatsapp) {
    return NextResponse.json(
      { error: 'full_name, grade, and whatsapp are required' },
      { status: 400 },
    )
  }

  const phone = whatsapp.replace(/\D/g, '')
  if (!phone) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const db = createServiceClient()

  // Check if student already exists by phone
  const variants = [phone]
  if (phone.startsWith('8')) variants.push('7' + phone.slice(1))
  if (phone.startsWith('7')) variants.push('8' + phone.slice(1))

  const { data: existing } = await db
    .from('students')
    .select('id, login, password_plain, full_name, olympiad_id, language')
    .in('whatsapp', variants)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Student with this phone already exists', student: existing[0] },
      { status: 409 },
    )
  }

  // Find olympiad with status='registration' that includes this grade
  const { data: olympiads } = await db
    .from('olympiads')
    .select('id, name_ru, target_grades')
    .eq('status', 'registration')

  const gradeStr = String(grade).trim()
  const matched = olympiads?.find(
    (o: { target_grades: string[] | null }) =>
      o.target_grades && o.target_grades.includes(gradeStr),
  )

  // Generate credentials
  const { data: allStudents } = await db.from('students').select('login')
  const existingLogins = new Set((allStudents ?? []).map((s: { login: string }) => s.login))
  const login = generateUniqueLogin(full_name, existingLogins)
  const password_plain = generatePassword()
  const password_hash = await bcrypt.hash(password_plain, 10)

  const { data: student, error } = await db
    .from('students')
    .insert({
      full_name: full_name.trim(),
      school: school?.trim() ?? null,
      grade: gradeStr,
      district: district?.trim() ?? null,
      language: language ?? 'ru',
      login,
      password_hash,
      password_plain,
      olympiad_id: matched?.id ?? null,
      whatsapp: phone,
    })
    .select('id, full_name, login, password_plain, olympiad_id, language')
    .single()

  if (error) {
    console.error('[POST /api/student] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ...student,
    olympiad_name: matched?.name_ru ?? null,
  }, { status: 201 })
}
