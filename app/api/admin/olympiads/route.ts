import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

// GET /api/admin/olympiads
export async function GET(req: NextRequest) {
  try {
    console.log('[GET /api/admin/olympiads] ENV check:', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK' : 'MISSING',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'OK' : 'MISSING',
      jwtSecret: process.env.JWT_SECRET ? 'OK' : 'MISSING (using default)',
    })

    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('olympiads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/admin/olympiads] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[GET /api/admin/olympiads] Unhandled exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/admin/olympiads — create
export async function POST(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      name_ru, name_kz, subject, start_time, duration_minutes,
      intro_video_url, intro_text_ru, intro_text_kz, outro_video_url,
      cert_range_winner_min, cert_range_prize_min, cert_range_pass_min,
      target_grades,
    } = body

    if (!name_ru || !name_kz) {
      return NextResponse.json({ error: 'name_ru and name_kz required' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('olympiads')
      .insert({
        name_ru: name_ru.trim(),
        name_kz: name_kz.trim(),
        subject: subject?.trim() ?? null,
        start_time: start_time ?? null,
        duration_minutes: duration_minutes ?? 60,
        status: 'draft',
        intro_video_url: intro_video_url?.trim() ?? null,
        intro_text_ru: intro_text_ru?.trim() ?? null,
        intro_text_kz: intro_text_kz?.trim() ?? null,
        outro_video_url: outro_video_url?.trim() ?? null,
        cert_range_winner_min: cert_range_winner_min ?? 90,
        cert_range_prize_min: cert_range_prize_min ?? 75,
        cert_range_pass_min: cert_range_pass_min ?? 50,
        target_grades: target_grades ?? [],
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/admin/olympiads] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('[POST /api/admin/olympiads] Unhandled exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/admin/olympiads?id=... — update fields
export async function PATCH(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const db = createServiceClient()
    const { data, error } = await db
      .from('olympiads')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/admin/olympiads] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[PATCH /api/admin/olympiads] Unhandled exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE /api/admin/olympiads?id=...
export async function DELETE(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = createServiceClient()
    const { error } = await db.from('olympiads').delete().eq('id', id)
    if (error) {
      console.error('[DELETE /api/admin/olympiads] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/admin/olympiads] Unhandled exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
