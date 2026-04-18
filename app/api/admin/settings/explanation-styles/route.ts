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
      .from('explanation_styles')
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
    const { code, name_ru, name_kz, icon, order_num, is_active } = body
    if (!code || !name_ru) {
      return NextResponse.json({ error: 'code и name_ru обязательны' }, { status: 400 })
    }

    const db = createServiceClient()
    const { data, error } = await db
      .from('explanation_styles')
      .insert({
        code: String(code).trim(),
        name_ru: String(name_ru).trim(),
        name_kz: String(name_kz ?? '').trim(),
        icon: icon ?? null,
        order_num: order_num ?? 0,
        is_active: is_active ?? true,
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
      .from('explanation_styles')
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
    const { data: style, error: fetchErr } = await db
      .from('explanation_styles')
      .select('code')
      .eq('id', id)
      .single()
    if (fetchErr || !style) {
      return NextResponse.json({ error: 'Стиль не найден' }, { status: 404 })
    }

    const { count, error: cntErr } = await db
      .from('explanations')
      .select('id', { count: 'exact', head: true })
      .eq('style_code', style.code)
    if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 })
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Нельзя удалить: используется в ${count} объяснениях` },
        { status: 409 },
      )
    }

    const { error } = await db.from('explanation_styles').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
