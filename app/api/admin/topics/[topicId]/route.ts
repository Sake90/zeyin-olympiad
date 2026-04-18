import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

type ExplanationInput = {
  style_code: string
  title_ru?: string | null
  title_kz?: string | null
  content_ru?: string | null
  content_kz?: string | null
  image_url?: string | null
  video_id?: string | null
}

type QuestionInput = {
  id?: string
  question_ru: string
  question_kz?: string
  option_a_ru?: string; option_b_ru?: string; option_c_ru?: string; option_d_ru?: string
  option_a_kz?: string; option_b_kz?: string; option_c_kz?: string; option_d_kz?: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  order_num?: number
}

// GET — topic + explanations[] + lesson_questions[]
export async function GET(req: NextRequest, { params }: { params: { topicId: string } }) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const db = createServiceClient()
    const [topicRes, expsRes, qsRes, stylesRes] = await Promise.all([
      db.from('topics').select('*').eq('id', params.topicId).single(),
      db.from('explanations').select('*').eq('topic_id', params.topicId),
      db.from('lesson_questions').select('*').eq('topic_id', params.topicId).order('order_num', { ascending: true }),
      db.from('explanation_styles').select('*').eq('is_active', true).order('order_num', { ascending: true }),
    ])
    if (topicRes.error) return NextResponse.json({ error: topicRes.error.message }, { status: 404 })
    if (expsRes.error) return NextResponse.json({ error: expsRes.error.message }, { status: 500 })
    if (qsRes.error) return NextResponse.json({ error: qsRes.error.message }, { status: 500 })
    if (stylesRes.error) return NextResponse.json({ error: stylesRes.error.message }, { status: 500 })

    return NextResponse.json({
      topic: topicRes.data,
      explanations: expsRes.data,
      questions: qsRes.data,
      styles: stylesRes.data,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH — body: { topic, explanations, questions }
export async function PATCH(req: NextRequest, { params }: { params: { topicId: string } }) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json() as {
      topic?: { title_ru?: string; title_kz?: string; order_num?: number; is_published?: boolean }
      explanations?: ExplanationInput[]
      questions?: QuestionInput[]
    }

    if (body.topic && (!body.topic.title_ru || !body.topic.title_ru.trim())) {
      return NextResponse.json({ error: 'title_ru обязателен' }, { status: 400 })
    }
    if (body.questions) {
      for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i]
        if (!q.question_ru || !q.question_ru.trim()) {
          return NextResponse.json({ error: `Вопрос ${i + 1}: question_ru обязателен` }, { status: 400 })
        }
        if (!(['A', 'B', 'C', 'D'] as string[]).includes(q.correct_option)) {
          return NextResponse.json({ error: `Вопрос ${i + 1}: выберите правильный ответ` }, { status: 400 })
        }
      }
    }

    const db = createServiceClient()
    const topicId = params.topicId

    // 1. Update topic
    if (body.topic) {
      const { error } = await db.from('topics').update(body.topic).eq('id', topicId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 2. Upsert explanations (by topic_id + style_code)
    if (body.explanations && body.explanations.length > 0) {
      const payload = body.explanations.map(e => ({
        topic_id: topicId,
        style_code: e.style_code,
        title_ru: e.title_ru ?? null,
        title_kz: e.title_kz ?? null,
        content_ru: e.content_ru ?? null,
        content_kz: e.content_kz ?? null,
        image_url: e.image_url ?? null,
        video_id: e.video_id ?? null,
      }))
      const { error } = await db
        .from('explanations')
        .upsert(payload, { onConflict: 'topic_id,style_code' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 3. Questions — diff by id
    if (body.questions) {
      const { data: existing, error: existErr } = await db
        .from('lesson_questions')
        .select('id')
        .eq('topic_id', topicId)
      if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })

      const existingIds = (existing ?? []).map(r => r.id as string)
      const incomingIds = new Set(body.questions.filter(q => q.id).map(q => q.id as string))
      const toDelete = existingIds.filter(id => !incomingIds.has(id))

      if (toDelete.length > 0) {
        const { error } = await db.from('lesson_questions').delete().in('id', toDelete)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const upsertPayload = body.questions.map((q, i) => ({
        ...(q.id ? { id: q.id } : {}),
        topic_id: topicId,
        question_ru: q.question_ru,
        question_kz: q.question_kz ?? '',
        option_a_ru: q.option_a_ru ?? '',
        option_b_ru: q.option_b_ru ?? '',
        option_c_ru: q.option_c_ru ?? '',
        option_d_ru: q.option_d_ru ?? '',
        option_a_kz: q.option_a_kz ?? '',
        option_b_kz: q.option_b_kz ?? '',
        option_c_kz: q.option_c_kz ?? '',
        option_d_kz: q.option_d_kz ?? '',
        correct_option: q.correct_option,
        order_num: q.order_num ?? i + 1,
      }))

      if (upsertPayload.length > 0) {
        const { error } = await db.from('lesson_questions').upsert(upsertPayload)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH topic]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
