import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

interface PathCtx { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { direction } = await req.json().catch(() => ({}))
  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json({ error: 'direction должен быть up или down' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: current, error: currentErr } = await db
    .from('trainer_questions')
    .select('id, test_id, order_index')
    .eq('id', params.id)
    .single()
  if (currentErr || !current) {
    return NextResponse.json({ error: 'Вопрос не найден' }, { status: 404 })
  }

  const { data: all, error } = await db
    .from('trainer_questions')
    .select('id, order_index')
    .eq('test_id', current.test_id)
    .order('order_index', { ascending: true })
  if (error || !all) {
    return NextResponse.json({ error: error?.message ?? 'load failed' }, { status: 500 })
  }

  const idx = all.findIndex(q => q.id === params.id)
  const neighbourIdx = direction === 'up' ? idx - 1 : idx + 1
  if (neighbourIdx < 0 || neighbourIdx >= all.length) {
    return NextResponse.json({ ok: true, swapped: false })
  }

  const a = current.order_index
  const b = all[neighbourIdx].order_index
  const aNew = a === b ? (direction === 'down' ? b + 1 : b - 1) : b
  const bNew = a === b ? a : a

  const [u1, u2] = await Promise.all([
    db.from('trainer_questions').update({ order_index: aNew }).eq('id', current.id),
    db.from('trainer_questions').update({ order_index: bNew }).eq('id', all[neighbourIdx].id),
  ])
  if (u1.error || u2.error) {
    return NextResponse.json(
      { error: u1.error?.message ?? u2.error?.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, swapped: true })
}
