import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'zeyin-secret-change-in-production'
)

// Routes that require student auth
const STUDENT_ROUTES = ['/intro', '/quiz', '/result', '/certificate']
// Routes that require admin auth
const ADMIN_ROUTES = ['/admin']
// Admin login page — skip auth check
const ADMIN_LOGIN = '/admin/login'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Admin routes ──────────────────────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== ADMIN_LOGIN) {
    const token = req.cookies.get('zeyin_admin')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      if (payload.role !== 'admin') throw new Error('Not admin')
    } catch {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
    return NextResponse.next()
  }

  // ── Student routes ────────────────────────────────────────────
  if (STUDENT_ROUTES.some(r => pathname.startsWith(r))) {
    const token = req.cookies.get('zeyin_student')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    try {
      await jwtVerify(token, JWT_SECRET)
    } catch {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/intro',
    '/quiz',
    '/result',
    '/certificate',
  ],
}
