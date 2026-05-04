import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'
import { validateQuestion } from '@/lib/trainer-validate'

interface PathCtx { params: { id: string } }

// POST — create a question for the given test. Auto-assigns order_index
// to (max + 1) so manual creation always appends at the end.
export async function POST(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const validated = validateQuestion(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: test, error: testErr } = await db
    .from('trainer_tests')
    .select('id')
    .eq('id', params.id)
    .single()
  if (testErr || !test) {
    return NextResponse.json({ error: 'Тест не найден' }, { status: 404 })
  }

  const { data: maxRow } = await db
    .from('trainer_questions')
    .select('order_index')
    .eq('test_id', params.id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const next = (maxRow?.order_index ?? 0) + 1

  const { data, error } = await db
    .from('trainer_questions')
    .insert({ test_id: params.id, order_index: next, ...validated })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data!.id })
}
