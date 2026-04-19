import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { ensureStudentStats, getActiveCourse, getOrInitProgress } from '@/lib/learn'

export async function GET(req: NextRequest) {
  const session = await getStudentSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const course = await getActiveCourse(db)
  if (!course) {
    await ensureStudentStats(db, session.studentId)
    return NextResponse.json({ course: null, topics: [] })
  }

  const { topics, progress } = await getOrInitProgress(db, session.studentId, course.id)
  await ensureStudentStats(db, session.studentId)

  const topicsWithStatus = topics.map(t => {
    const p = progress.find(pp => pp.topic_id === t.id)
    return {
      ...t,
      status: p?.status ?? 'locked',
      score: p?.score ?? null,
      attempts: p?.attempts ?? 0,
      completed_at: p?.completed_at ?? null,
    }
  })

  return NextResponse.json({ course, topics: topicsWithStatus })
}
