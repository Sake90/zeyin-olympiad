import { NextRequest, NextResponse } from 'next/server'
import { signAdminToken, setAdminCookieHeader, clearAdminCookieHeader } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  }

  const token = await signAdminToken()
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', setAdminCookieHeader(token))
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', clearAdminCookieHeader())
  return res
}
