import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

// GET /api/admin/results?olympiad_id=...
export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const olympiadId = req.nextUrl.searchParams.get('olympiad_id')
  if (!olympiadId) return NextResponse.json({ error: 'olympiad_id required' }, { status: 400 })

  const db = createServiceClient()
  const [{ data: results, error }, { data: olympiad }] = await Promise.all([
    db.from('results')
      .select('*, students(full_name, school, grade, district, language)')
      .eq('olympiad_id', olympiadId)
      .order('score', { ascending: false }),
    db.from('olympiads').select('subjects').eq('id', olympiadId).single(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ results: results ?? [], subjects: (olympiad?.subjects ?? []) })
}
