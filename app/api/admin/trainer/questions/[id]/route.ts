import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'
import { validateQuestion } from '@/lib/trainer-validate'

interface PathCtx { params: { id: string } }

// PATCH — full update (we always send all fields from the modal editor).
export async function PATCH(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const validated = validateQuestion(body)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }
  const db = createServiceClient()
  const { error } = await db
    .from('trainer_questions')
    .update(validated)
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createServiceClient()
  const { error } = await db.from('trainer_questions').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
