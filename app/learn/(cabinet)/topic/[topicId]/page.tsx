import { redirect, notFound } from 'next/navigation'
import { getStudentSession } from '@/lib/auth'
import {
  createServiceClient,
  type Explanation,
  type ExplanationStyle,
  type Language,
  type StudentProgress,
  type Topic,
} from '@/lib/supabase'
import { TopicClient, type ClientQuestion } from './TopicClient'

export const dynamic = 'force-dynamic'

export default async function TopicPage({ params }: { params: { topicId: string } }) {
  const session = await getStudentSession()
  if (!session) redirect('/learn/login')

  const db = createServiceClient()

  const { data: student } = await db
    .from('students')
    .select('language')
    .eq('id', session.studentId)
    .maybeSingle()
  const language: Language = (student as any)?.language ?? session.language ?? 'ru'

  const { data: topic } = await db
    .from('topics')
    .select('*')
    .eq('id', params.topicId)
    .maybeSingle()
  if (!topic) notFound()

  const { data: progress } = await db
    .from('student_progress')
    .select('*')
    .eq('student_id', session.studentId)
    .eq('topic_id', params.topicId)
    .maybeSingle()
  if (progress && (progress as StudentProgress).status === 'locked') {
    redirect('/learn/study')
  }

  const { data: explanations } = await db
    .from('explanations')
    .select('*')
    .eq('topic_id', params.topicId)

  const { data: styles } = await db
    .from('explanation_styles')
    .select('*')
    .eq('is_active', true)
    .order('order_num', { ascending: true })

  const activeStyleCodes = new Set((styles ?? []).map((s: any) => s.code))
  const filteredExplanations = ((explanations ?? []) as Explanation[]).filter(e =>
    activeStyleCodes.has(e.style_code)
  )

  const { data: rawQuestions } = await db
    .from('lesson_questions')
    .select(
      'id, question_ru, question_kz, option_a_ru, option_b_ru, option_c_ru, option_d_ru, option_a_kz, option_b_kz, option_c_kz, option_d_kz, order_num'
    )
    .eq('topic_id', params.topicId)
    .order('order_num', { ascending: true })

  const questions: ClientQuestion[] = (rawQuestions ?? []) as ClientQuestion[]

  return (
    <TopicClient
      topic={topic as Topic}
      explanations={filteredExplanations}
      styles={(styles ?? []) as ExplanationStyle[]}
      questions={questions}
      language={language}
    />
  )
}
