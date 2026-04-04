import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

// POST /api/admin/olympiads/copy?id=...
// Copies olympiad + all questions, status = draft, no students/results
export async function POST(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = createServiceClient()

    // Fetch source olympiad
    const { data: src, error: srcErr } = await db
      .from('olympiads')
      .select('*')
      .eq('id', id)
      .single()

    if (srcErr || !src) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Create copy
    const { data: copy, error: copyErr } = await db
      .from('olympiads')
      .insert({
        name_ru: `(Копия) ${src.name_ru}`,
        name_kz: `(Копия) ${src.name_kz}`,
        subject: src.subject,
        start_time: null,
        duration_minutes: src.duration_minutes,
        status: 'draft',
        intro_video_url: src.intro_video_url,
        intro_text_ru: src.intro_text_ru,
        intro_text_kz: src.intro_text_kz,
        outro_video_url: src.outro_video_url,
        cert_range_winner_min: src.cert_range_winner_min,
        cert_range_prize_min: src.cert_range_prize_min,
        cert_range_pass_min: src.cert_range_pass_min,
        subjects: src.subjects ?? [],
      })
      .select()
      .single()

    if (copyErr || !copy) {
      return NextResponse.json({ error: copyErr?.message ?? 'Failed to create copy' }, { status: 500 })
    }

    // Copy questions
    const { data: questions } = await db
      .from('questions')
      .select('*')
      .eq('olympiad_id', id)
      .order('order_num', { ascending: true })

    if (questions && questions.length > 0) {
      const { error: qErr } = await db.from('questions').insert(
        questions.map(q => ({
          olympiad_id: copy.id,
          type: q.type,
          question_ru: q.question_ru,
          question_kz: q.question_kz,
          option_a_ru: q.option_a_ru,
          option_b_ru: q.option_b_ru,
          option_c_ru: q.option_c_ru,
          option_d_ru: q.option_d_ru,
          option_a_kz: q.option_a_kz,
          option_b_kz: q.option_b_kz,
          option_c_kz: q.option_c_kz,
          option_d_kz: q.option_d_kz,
          correct_option: q.correct_option,
          youtube_url_ru: q.youtube_url_ru,
          youtube_url_kz: q.youtube_url_kz,
          image_url: q.image_url,
          order_num: q.order_num,
        }))
      )
      if (qErr) console.error('[copy questions] error:', qErr)
    }

    return NextResponse.json(copy, { status: 201 })
  } catch (e) {
    console.error('[POST /api/admin/olympiads/copy] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
