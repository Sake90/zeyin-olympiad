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
      .from('bird_moods')
      .select('*')
      .order('order_num', { ascending: true })
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
    const { code, name_ru, name_kz, icon, trigger_ru, trigger_kz, css_animation, order_num } = body
    if (!code || !name_ru) {
      return NextResponse.json({ error: 'code и name_ru обязательны' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('bird_moods')
      .insert({
        code: String(code).trim(),
        name_ru: String(name_ru).trim(),
        name_kz: String(name_kz ?? '').trim(),
        icon: icon ?? null,
        trigger_ru: trigger_ru ?? null,
        trigger_kz: trigger_kz ?? null,
        css_animation: css_animation ?? null,
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
    const db = createServiceClient()
    const { data, error } = await db
      .from('bird_moods')
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
    const { error } = await db.from('bird_moods').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
