import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { awardXpAndUpdateStreak, getConfigNumber, unlockNextTopic } from '@/lib/learn'

type IncomingAnswer = { questionId: string; selected: 'A' | 'B' | 'C' | 'D' }

export async function POST(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    topicId?: string
    styleCode?: string
    answers?: IncomingAnswer[]
  } | null

  if (!body?.topicId || !Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const db = createServiceClient()
  const { topicId, answers, styleCode } = body as Required<typeof body>

  const { data: topic } = await db
    .from('topics')
    .select('id')
    .eq('id', topicId)
    .maybeSingle()
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const { data: existingProgress } = await db
    .from('student_progress')
    .select('*')
    .eq('student_id', session.studentId)
    .eq('topic_id', topicId)
    .maybeSingle()
  if (existingProgress && (existingProgress as any).status === 'locked') {
    return NextResponse.json({ error: 'Topic is locked' }, { status: 403 })
  }

  const questionIds = answers.map(a => a.questionId)
  const { data: dbQuestions } = await db
    .from('lesson_questions')
    .select('id, correct_option')
    .eq('topic_id', topicId)
    .in('id', questionIds)
  const truthMap = new Map<string, string>()
  ;(dbQuestions ?? []).forEach((q: any) => truthMap.set(q.id, q.correct_option))

  const attemptNum = ((existingProgress as any)?.attempts ?? 0) + 1

  const results = answers.map(a => {
    const correct = truthMap.get(a.questionId)
    const isCorrect = !!correct && correct === a.selected
    return { questionId: a.questionId, selected: a.selected, correct, isCorrect }
  })

  const correctCount = results.filter(r => r.isCorrect).length
  const total = answers.length
  const score = Math.round((correctCount / total) * 100)

  const threshold = await getConfigNumber(db, 'test_pass_threshold', 70)
  const passed = score >= threshold

  const answerRows = results
    .filter(r => r.correct)
    .map(r => ({
      student_id: session.studentId,
      question_id: r.questionId,
      topic_id: topicId,
      selected_option: r.selected,
      is_correct: r.isCorrect,
      attempt_num: attemptNum,
    }))
  if (answerRows.length > 0) {
    await db.from('lesson_answers').insert(answerRows)
  }

  const progressPayload: Record<string, unknown> = {
    student_id: session.studentId,
    topic_id: topicId,
    attempts: attemptNum,
    style_used: styleCode ?? (existingProgress as any)?.style_used ?? null,
    score,
    status: passed ? 'completed' : 'in_progress',
    completed_at: passed ? new Date().toISOString() : (existingProgress as any)?.completed_at ?? null,
  }
  await db
    .from('student_progress')
    .upsert(progressPayload, { onConflict: 'student_id,topic_id' })

  let nextTopicId: string | null = null
  let xpAwarded = 0
  const wasCompletedBefore = (existingProgress as any)?.status === 'completed'
  if (passed && !wasCompletedBefore) {
    nextTopicId = await unlockNextTopic(db, session.studentId, topicId)
    const xpPerTopic = await getConfigNumber(db, 'xp_per_topic', 10)
    xpAwarded = xpPerTopic
    await awardXpAndUpdateStreak(db, session.studentId, xpAwarded)
  }

  const clientResults = results.map(r => ({
    questionId: r.questionId,
    selected: r.selected,
    correct: r.correct,
    isCorrect: r.isCorrect,
  }))

  return NextResponse.json({
    score,
    correctCount,
    total,
    passed,
    threshold,
    xpAwarded,
    nextTopicId,
    results: clientResults,
  })
}
