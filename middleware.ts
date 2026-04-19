import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'zeyin-secret-change-in-production'
)

// Olympiad flow — redirects unauthorized to /login
const OLYMPIAD_ROUTES = ['/intro', '/quiz', '/result', '/certificate']
// Learning cabinet — redirects unauthorized to /learn/login
const LEARN_ROUTE_PREFIX = '/learn'
const LEARN_LOGIN = '/learn/login'
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

  // ── Learning cabinet (redirects to /learn/login) ──────────────
  if (pathname.startsWith(LEARN_ROUTE_PREFIX) && pathname !== LEARN_LOGIN) {
    const token = req.cookies.get('zeyin_student')?.value
    if (!token) {
      return NextResponse.redirect(new URL(LEARN_LOGIN, req.url))
    }
    try {
      await jwtVerify(token, JWT_SECRET)
    } catch {
      return NextResponse.redirect(new URL(LEARN_LOGIN, req.url))
    }
    return NextResponse.next()
  }

  // ── Olympiad routes (redirects to /login) ─────────────────────
  if (OLYMPIAD_ROUTES.some(r => pathname.startsWith(r))) {
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
    '/learn/:path*',
  ],
}
