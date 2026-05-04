import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

interface PathCtx { params: { id: string } }

// GET — single test (used by the editor page initial load)
export async function GET(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createServiceClient()
  const { data: test, error } = await db
    .from('trainer_tests')
    .select('id, title, description, order_index, unlock_at, is_unlocked, time_limit_minutes')
    .eq('id', params.id)
    .single()
  if (error || !test) {
    return NextResponse.json({ error: 'Тест не найден' }, { status: 404 })
  }

  const { data: questions } = await db
    .from('trainer_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, order_index')
    .eq('test_id', params.id)
    .order('order_index', { ascending: true })

  return NextResponse.json({ test, questions: questions ?? [] })
}

// PATCH — update metadata
export async function PATCH(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}

  if (typeof body.title === 'string') {
    const t = body.title.trim()
    if (!t) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
    update.title = t
  }
  if (typeof body.description === 'string' || body.description === null) {
    update.description = typeof body.description === 'string' && body.description.trim()
      ? body.description.trim() : null
  }
  if (typeof body.order_index === 'number' && Number.isFinite(body.order_index)) {
    update.order_index = Math.floor(body.order_index)
  }
  if ('time_limit_minutes' in body) {
    const tl = body.time_limit_minutes
    if (tl === null || tl === '' || tl === undefined) {
      update.time_limit_minutes = null
    } else {
      const n = typeof tl === 'number' ? tl : Number(tl)
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json(
          { error: 'Лимит времени должен быть положительным числом' },
          { status: 400 }
        )
      }
      update.time_limit_minutes = Math.floor(n)
    }
  }
  if ('is_unlocked' in body) {
    update.is_unlocked = body.is_unlocked === true
  }
  if ('unlock_at' in body) {
    if (body.unlock_at === null || body.unlock_at === '') {
      update.unlock_at = null
    } else if (typeof body.unlock_at === 'string') {
      const d = new Date(body.unlock_at)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Неверная дата открытия' }, { status: 400 })
      }
      update.unlock_at = d.toISOString()
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const db = createServiceClient()
  const { error } = await db.from('trainer_tests').update(update).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — cascades to questions/attempts/answers
export async function DELETE(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createServiceClient()
  const { error } = await db.from('trainer_tests').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
