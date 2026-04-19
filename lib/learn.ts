import type { SupabaseClient } from '@supabase/supabase-js'
import type { Course, Topic, StudentProgress, StudentStats, XpLevel } from './supabase'

export async function getActiveCourse(db: SupabaseClient): Promise<Course | null> {
  const { data } = await db
    .from('courses')
    .select('*')
    .eq('is_active', true)
    .order('order_num', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as Course) ?? null
}

export async function getPublishedTopics(db: SupabaseClient, courseId: string): Promise<Topic[]> {
  const { data } = await db
    .from('topics')
    .select('*')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('order_num', { ascending: true })
  return (data as Topic[]) ?? []
}

export async function ensureStudentStats(db: SupabaseClient, studentId: string): Promise<StudentStats> {
  const { data: existing } = await db
    .from('student_stats')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()
  if (existing) return existing as StudentStats
  const defaults: Partial<StudentStats> = {
    student_id: studentId,
    current_streak: 0,
    max_streak: 0,
    last_activity_date: null,
    streak_grace_days: 0,
    total_xp: 0,
    level_code: 'beginner',
    bird_stage_code: 'egg',
    bird_mood_code: null,
    days_active: 0,
  }
  const { data } = await db.from('student_stats').insert(defaults).select('*').single()
  return data as StudentStats
}

export async function getOrInitProgress(
  db: SupabaseClient,
  studentId: string,
  courseId: string
): Promise<{ topics: Topic[]; progress: StudentProgress[] }> {
  const topics = await getPublishedTopics(db, courseId)
  if (topics.length === 0) return { topics, progress: [] }

  const topicIds = topics.map(t => t.id)
  const { data: existing } = await db
    .from('student_progress')
    .select('*')
    .eq('student_id', studentId)
    .in('topic_id', topicIds)

  const progress = (existing as StudentProgress[]) ?? []

  const missingIds = topicIds.filter(tid => !progress.find(p => p.topic_id === tid))
  if (missingIds.length === 0) return { topics, progress }

  const firstOrder = topics[0].order_num
  const rows = topics
    .filter(t => missingIds.includes(t.id))
    .map(t => ({
      student_id: studentId,
      topic_id: t.id,
      status:
        t.order_num === firstOrder && !progress.find(p => p.status !== 'locked')
          ? 'available'
          : 'locked',
      attempts: 0,
    }))

  const { data: inserted } = await db.from('student_progress').insert(rows).select('*')
  const allProgress = [...progress, ...((inserted as StudentProgress[]) ?? [])]
  return { topics, progress: allProgress }
}

export async function unlockNextTopic(
  db: SupabaseClient,
  studentId: string,
  completedTopicId: string
): Promise<string | null> {
  const { data: completed } = await db
    .from('topics')
    .select('course_id, order_num')
    .eq('id', completedTopicId)
    .maybeSingle()
  if (!completed) return null

  const { data: next } = await db
    .from('topics')
    .select('id')
    .eq('course_id', (completed as any).course_id)
    .eq('is_published', true)
    .gt('order_num', (completed as any).order_num)
    .order('order_num', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!next) return null

  const nextId = (next as any).id as string

  const { data: existing } = await db
    .from('student_progress')
    .select('*')
    .eq('student_id', studentId)
    .eq('topic_id', nextId)
    .maybeSingle()

  if (existing) {
    if ((existing as StudentProgress).status === 'locked') {
      await db
        .from('student_progress')
        .update({ status: 'available' })
        .eq('student_id', studentId)
        .eq('topic_id', nextId)
    }
  } else {
    await db.from('student_progress').insert({
      student_id: studentId,
      topic_id: nextId,
      status: 'available',
      attempts: 0,
    })
  }

  return nextId
}

export async function getConfigNumber(
  db: SupabaseClient,
  key: string,
  fallback: number
): Promise<number> {
  const { data } = await db
    .from('platform_config')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (!data) return fallback
  const n = Number((data as any).value)
  return Number.isFinite(n) ? n : fallback
}

export async function getLevelForXp(db: SupabaseClient, totalXp: number): Promise<XpLevel | null> {
  const { data } = await db
    .from('xp_levels')
    .select('*')
    .lte('min_xp', totalXp)
    .order('min_xp', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as XpLevel) ?? null
}

export async function awardXpAndUpdateStreak(
  db: SupabaseClient,
  studentId: string,
  xpDelta: number
): Promise<StudentStats> {
  const stats = await ensureStudentStats(db, studentId)

  const today = new Date().toISOString().slice(0, 10)
  const last = stats.last_activity_date
  let currentStreak = stats.current_streak
  let daysActive = stats.days_active
  if (last !== today) {
    daysActive += 1
    if (last) {
      const lastDate = new Date(last)
      const todayDate = new Date(today)
      const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000)
      currentStreak = diffDays === 1 ? currentStreak + 1 : 1
    } else {
      currentStreak = 1
    }
  }
  const maxStreak = Math.max(stats.max_streak, currentStreak)
  const totalXp = stats.total_xp + xpDelta

  const level = await getLevelForXp(db, totalXp)

  const { data: updated } = await db
    .from('student_stats')
    .update({
      total_xp: totalXp,
      current_streak: currentStreak,
      max_streak: maxStreak,
      last_activity_date: today,
      days_active: daysActive,
      level_code: level?.code ?? stats.level_code,
    })
    .eq('student_id', studentId)
    .select('*')
    .single()

  return updated as StudentStats
}
