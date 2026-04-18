import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

// GET /api/admin/settings/config — все строки platform_config
export async function GET(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('platform_config')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true })

    if (error) {
      console.error('[GET /api/admin/settings/config] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/admin/settings/config] Unhandled:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/admin/settings/config — body: [{ key, value }]
export async function PATCH(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { key: string; value: string }[]
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: 'Expected non-empty array' }, { status: 400 })
    }

    const db = createServiceClient()
    const now = new Date().toISOString()

    for (const item of body) {
      if (!item.key) continue
      const { error } = await db
        .from('platform_config')
        .update({ value: String(item.value ?? ''), updated_at: now })
        .eq('key', item.key)
      if (error) {
        console.error('[PATCH /api/admin/settings/config] Supabase error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /api/admin/settings/config] Unhandled:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
