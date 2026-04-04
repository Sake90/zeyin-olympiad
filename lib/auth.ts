import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'zeyin-secret-change-in-production'
)

const STUDENT_COOKIE = 'zeyin_student'
const ADMIN_COOKIE = 'zeyin_admin'

// ─── Student JWT ──────────────────────────────────────────────────────────────

export interface StudentPayload {
  studentId: string
  olympiadId: string
  language: 'kz' | 'ru'
}

export async function signStudentToken(payload: StudentPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET)
}

export async function verifyStudentToken(token: string): Promise<StudentPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as StudentPayload
  } catch {
    return null
  }
}

export async function getStudentSession(): Promise<StudentPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(STUDENT_COOKIE)?.value
  if (!token) return null
  return verifyStudentToken(token)
}

export function getStudentSessionFromRequest(req: NextRequest): Promise<StudentPayload | null> {
  const token = req.cookies.get(STUDENT_COOKIE)?.value
  if (!token) return Promise.resolve(null)
  return verifyStudentToken(token)
}

export function setStudentCookieHeader(token: string) {
  return `${STUDENT_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`
}

export function clearStudentCookieHeader() {
  return `${STUDENT_COOKIE}=; HttpOnly; Path=/; Max-Age=0`
}

// ─── Admin JWT ────────────────────────────────────────────────────────────────

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(JWT_SECRET)
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.role === 'admin'
  } catch {
    return false
  }
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!token) return false
  return verifyAdminToken(token)
}

export function getAdminSessionFromRequest(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!token) return Promise.resolve(false)
  return verifyAdminToken(token)
}

export function setAdminCookieHeader(token: string) {
  return `${ADMIN_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax`
}

export function clearAdminCookieHeader() {
  return `${ADMIN_COOKIE}=; HttpOnly; Path=/; Max-Age=0`
}
