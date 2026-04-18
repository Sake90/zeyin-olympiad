import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const db = createServiceClient()
    const { data, error } = await db
      .from('xp_levels')
      .select('*')
      .order('min_xp', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const { code, name_ru, name_kz, icon, min_xp, order_num } = body
    if (!code || !name_ru) {
      return NextResponse.json({ error: 'code и name_ru обязательны' }, { status: 400 })
    }
    if (typeof min_xp !== 'number' || min_xp < 0) {
      return NextResponse.json({ error: 'min_xp должно быть >= 0' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('xp_levels')
      .insert({
        code: String(code).trim(),
        name_ru: String(name_ru).trim(),
        name_kz: String(name_kz ?? '').trim(),
        icon: icon ?? null,
        min_xp,
        order_num: order_num ?? 0,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await req.json()
    if (body.min_xp !== undefined && (typeof body.min_xp !== 'number' || body.min_xp < 0)) {
      return NextResponse.json({ error: 'min_xp должно быть >= 0' }, { status: 400 })
    }
    const db = createServiceClient()
    const { data, error } = await db
      .from('xp_levels')
      .update(body)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = createServiceClient()
    const { error } = await db.from('xp_levels').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
