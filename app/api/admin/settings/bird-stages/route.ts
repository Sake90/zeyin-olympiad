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
      .from('bird_stages')
      .select('*')
      .order('min_days_active', { ascending: true })
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
    const { code, name_ru, name_kz, icon, min_days_active, order_num } = body
    if (!code || !name_ru) {
      return NextResponse.json({ error: 'code и name_ru обязательны' }, { status: 400 })
    }
    if (typeof min_days_active !== 'number' || min_days_active < 0) {
      return NextResponse.json({ error: 'min_days_active должно быть >= 0' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('bird_stages')
      .insert({
        code: String(code).trim(),
        name_ru: String(name_ru).trim(),
        name_kz: String(name_kz ?? '').trim(),
        icon: icon ?? null,
        min_days_active,
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
    if (body.min_days_active !== undefined && (typeof body.min_days_active !== 'number' || body.min_days_active < 0)) {
      return NextResponse.json({ error: 'min_days_active должно быть >= 0' }, { status: 400 })
    }
    const db = createServiceClient()
    const { data, error } = await db
      .from('bird_stages')
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
    const { error } = await db.from('bird_stages').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
