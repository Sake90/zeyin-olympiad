// WhatsApp bot endpoint: GET /api/student?phone=77XXXXXXXXX
// Auth: x-api-key header must match BOT_API_KEY env var

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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
