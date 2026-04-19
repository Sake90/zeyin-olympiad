import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { ensureStudentStats, getLevelForXp } from '@/lib/learn'

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const stats = await ensureStudentStats(db, session.studentId)
  const level = await getLevelForXp(db, stats.total_xp)

  const { data: bird } = stats.bird_stage_code
    ? await db.from('bird_stages').select('*').eq('code', stats.bird_stage_code).maybeSingle()
    : { data: null }

  return NextResponse.json({ stats, level, bird })
}
