import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/olympiad/active — public, no auth
// Returns name of the active olympiad (or default fallback)
export async function GET() {
  const db = createServiceClient()
  const { data } = await db
    .from('olympiads')
    .select('name_ru, name_kz')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    name_ru: data?.name_ru ?? 'ZEYIN OLYMPIAD',
    name_kz: data?.name_kz ?? 'ZEYIN OLYMPIAD',
  })
}
