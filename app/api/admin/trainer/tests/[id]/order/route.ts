import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

interface PathCtx { params: { id: string } }

// PATCH — swap order_index with the immediate neighbour in a given direction.
// Body: { direction: 'up' | 'down' }
export async function PATCH(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { direction } = await req.json().catch(() => ({}))
  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json({ error: 'direction должен быть up или down' }, { status: 400 })
  }

  const db = createServiceClient()

  // Load all tests sorted the way the UI shows them.
  const { data: all, error } = await db
    .from('trainer_tests')
    .select('id, order_index, created_at')
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true })
  if (error || !all) {
    return NextResponse.json({ error: error?.message ?? 'load failed' }, { status: 500 })
  }

  const idx = all.findIndex(t => t.id === params.id)
  if (idx === -1) {
    return NextResponse.json({ error: 'Тест не найден' }, { status: 404 })
  }
  const neighbourIdx = direction === 'up' ? idx - 1 : idx + 1
  if (neighbourIdx < 0 || neighbourIdx >= all.length) {
    return NextResponse.json({ ok: true, swapped: false })
  }

  const current = all[idx]
  const neighbour = all[neighbourIdx]

  // Swap order_index. If they're tied (e.g. both still at default 0), bump one
  // so the UI sort stabilises on the next reload.
  const a = current.order_index
  const b = neighbour.order_index
  const aNew = a === b ? (direction === 'down' ? b + 1 : b - 1) : b
  const bNew = a === b ? a : a

  const [u1, u2] = await Promise.all([
    db.from('trainer_tests').update({ order_index: aNew }).eq('id', current.id),
    db.from('trainer_tests').update({ order_index: bNew }).eq('id', neighbour.id),
  ])
  if (u1.error || u2.error) {
    return NextResponse.json(
      { error: u1.error?.message ?? u2.error?.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, swapped: true })
}
