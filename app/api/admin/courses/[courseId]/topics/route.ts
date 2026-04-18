import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

// GET /api/admin/courses/[courseId]/topics
export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const db = createServiceClient()
    const [courseRes, topicsRes] = await Promise.all([
      db.from('courses').select('*').eq('id', params.courseId).single(),
      db.from('topics').select('*').eq('course_id', params.courseId).order('order_num', { ascending: true }),
    ])
    if (courseRes.error) {
      return NextResponse.json({ error: courseRes.error.message }, { status: 404 })
    }
    if (topicsRes.error) {
      return NextResponse.json({ error: topicsRes.error.message }, { status: 500 })
    }
    return NextResponse.json({ course: courseRes.data, topics: topicsRes.data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/admin/courses/[courseId]/topics
export async function POST(req: NextRequest, { params }: { params: { courseId: string } }) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const { title_ru, title_kz, order_num, is_published } = body
    if (!title_ru) {
      return NextResponse.json({ error: 'title_ru обязателен' }, { status: 400 })
    }
    const db = createServiceClient()
    const { data, error } = await db
      .from('topics')
      .insert({
        course_id: params.courseId,
        title_ru: String(title_ru).trim(),
        title_kz: String(title_kz ?? '').trim(),
        order_num: order_num ?? 0,
        is_published: is_published ?? false,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/admin/courses/[courseId]/topics?id=
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
      .from('topics')
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

// DELETE /api/admin/courses/[courseId]/topics?id=
export async function DELETE(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = createServiceClient()
    const { error } = await db.from('topics').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
