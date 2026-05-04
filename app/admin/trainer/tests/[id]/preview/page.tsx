import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import PreviewRunClient, { type PreviewQuestion } from './PreviewRunClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

export default async function TrainerTestPreviewPage({ params }: PageProps) {
  const db = createServiceClient()

  const { data: test } = await db
    .from('trainer_tests')
    .select('id, title')
    .eq('id', params.id)
    .maybeSingle()
  if (!test) notFound()

  // For preview we send the questions WITHOUT correct answers — the admin sees
  // the test exactly as the student would.
  const { data: questionRows } = await db
    .from('trainer_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, order_index')
    .eq('test_id', params.id)
    .order('order_index', { ascending: true })

  const questions: PreviewQuestion[] = (questionRows ?? []).map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
  }))

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          В тесте нет вопросов. Добавьте хотя бы один и запустите превью снова.
        </div>
      </div>
    )
  }

  return <PreviewRunClient testId={test.id} title={test.title} questions={questions} />
}
