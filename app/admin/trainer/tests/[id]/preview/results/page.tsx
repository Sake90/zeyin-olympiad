import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'
import PreviewResultsClient, { type PreviewResultsQuestion } from './PreviewResultsClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

export default async function TrainerTestPreviewResultsPage({ params }: PageProps) {
  const db = createServiceClient()

  const { data: test } = await db
    .from('trainer_tests')
    .select('id, title')
    .eq('id', params.id)
    .maybeSingle()
  if (!test) notFound()

  // Preview-results shows correct answers and explanations — same data the
  // student sees on /trainer/test/[id]/results.
  const { data: questionRows } = await db
    .from('trainer_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, order_index')
    .eq('test_id', params.id)
    .order('order_index', { ascending: true })

  const questions = (questionRows ?? []) as PreviewResultsQuestion[]

  return (
    <PreviewResultsClient
      testId={test.id}
      title={test.title}
      questions={questions}
    />
  )
}
