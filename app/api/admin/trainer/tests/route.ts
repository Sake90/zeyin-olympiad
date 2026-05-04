import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

interface TestBody {
  title?: unknown
  description?: unknown
  order_index?: unknown
  time_limit_minutes?: unknown
  is_unlocked?: unknown
  unlock_at?: unknown
}

interface NormalizedTest {
  title: string
  description: string | null
  order_index: number
  time_limit_minutes: number | null
  is_unlocked: boolean
  unlock_at: string | null
}

function normalize(body: TestBody): NormalizedTest | { error: string } {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return { error: 'Название обязательно' }

  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null

  const orderIdxRaw = body.order_index
  const order_index =
    typeof orderIdxRaw === 'number' ? orderIdxRaw
    : typeof orderIdxRaw === 'string' && orderIdxRaw.trim() ? Number(orderIdxRaw)
    : 0
  if (!Number.isFinite(order_index)) return { error: 'order_index должен быть числом' }

  const tlRaw = body.time_limit_minutes
  let time_limit_minutes: number | null = null
  if (tlRaw !== null && tlRaw !== undefined && tlRaw !== '') {
    const n = typeof tlRaw === 'number' ? tlRaw : Number(tlRaw)
    if (!Number.isFinite(n) || n <= 0) {
      return { error: 'Лимит времени должен быть положительным числом' }
    }
    time_limit_minutes = Math.floor(n)
  }

  const is_unlocked = body.is_unlocked === true

  let unlock_at: string | null = null
  if (typeof body.unlock_at === 'string' && body.unlock_at.trim()) {
    const d = new Date(body.unlock_at)
    if (Number.isNaN(d.getTime())) return { error: 'Неверная дата открытия' }
    unlock_at = d.toISOString()
  }

  return { title, description, order_index: Math.floor(order_index), time_limit_minutes, is_unlocked, unlock_at }
}

// GET — list with question/attempt counts
export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const [testsRes, questionsRes, attemptsRes] = await Promise.all([
    db
      .from('trainer_tests')
      .select('id, title, description, order_index, unlock_at, is_unlocked, time_limit_minutes, created_at')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }),
    db.from('trainer_questions').select('test_id'),
    db.from('trainer_attempts').select('test_id'),
  ])

  if (testsRes.error) {
    return NextResponse.json({ error: testsRes.error.message }, { status: 500 })
  }

  const qCount = new Map<string, number>()
  for (const q of questionsRes.data ?? []) {
    qCount.set(q.test_id, (qCount.get(q.test_id) ?? 0) + 1)
  }
  const aCount = new Map<string, number>()
  for (const a of attemptsRes.data ?? []) {
    aCount.set(a.test_id, (aCount.get(a.test_id) ?? 0) + 1)
  }

  const tests = (testsRes.data ?? []).map(t => ({
    ...t,
    question_count: qCount.get(t.id) ?? 0,
    attempt_count: aCount.get(t.id) ?? 0,
  }))

  return NextResponse.json({ tests })
}

// POST — create
export async function POST(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as TestBody
  const result = normalize(body)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('trainer_tests')
    .insert(result)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data!.id })
}
