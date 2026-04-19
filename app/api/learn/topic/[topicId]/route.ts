import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { topicId: string } }
) {
  const session = await getStudentSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const topicId = params.topicId

  const { data: topic } = await db.from('topics').select('*').eq('id', topicId).maybeSingle()
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const { data: explanations } = await db
    .from('explanations')
    .select('*')
    .eq('topic_id', topicId)

  const { data: styles } = await db
    .from('explanation_styles')
    .select('*')
    .eq('is_active', true)
    .order('order_num', { ascending: true })

  const activeStyleCodes = new Set((styles ?? []).map((s: any) => s.code))
  const filteredExplanations = (explanations ?? []).filter((e: any) =>
    activeStyleCodes.has(e.style_code)
  )

  const { data: rawQuestions } = await db
    .from('lesson_questions')
    .select('*')
    .eq('topic_id', topicId)
    .order('order_num', { ascending: true })

  // Strip correct_option before returning to client
  const questions = (rawQuestions ?? []).map((q: any) => ({
    id: q.id,
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
    order_num: q.order_num,
  }))

  const { data: progress } = await db
    .from('student_progress')
    .select('*')
    .eq('student_id', session.studentId)
    .eq('topic_id', topicId)
    .maybeSingle()

  if (progress && (progress as any).status === 'locked') {
    return NextResponse.json({ error: 'Topic is locked' }, { status: 403 })
  }

  return NextResponse.json({
    topic,
    explanations: filteredExplanations,
    styles: styles ?? [],
    questions,
    progress: progress ?? null,
  })
}
