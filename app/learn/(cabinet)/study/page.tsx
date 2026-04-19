import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStudentSession } from '@/lib/auth'
import {
  createServiceClient,
  type Language,
  type ProgressStatus,
  type XpLevel,
} from '@/lib/supabase'
import {
  ensureStudentStats,
  getActiveCourse,
  getLevelForXp,
  getOrInitProgress,
} from '@/lib/learn'

export const dynamic = 'force-dynamic'

const tr = {
  ru: {
    noCourse: 'Курс ещё не назначен. Загляни позже.',
    noTopics: 'Темы пока не опубликованы.',
    subtitle: 'Мои предметы',
    level: 'Уровень',
    xp: 'XP',
    maxLevel: 'Макс. уровень',
    topicsDone: (a: number, b: number) => `${a} из ${b} тем завершено`,
  },
  kz: {
    noCourse: 'Курс әлі тағайындалмаған. Кейін кіріп көр.',
    noTopics: 'Тақырыптар әлі жарияланбаған.',
    subtitle: 'Менің пәндерім',
    level: 'Деңгей',
    xp: 'XP',
    maxLevel: 'Ең жоғары деңгей',
    topicsDone: (a: number, b: number) => `${b} тақырыптың ${a}-і аяқталды`,
  },
} as const

type TopicRow = {
  id: string
  title_ru: string
  title_kz: string
  order_num: number
  status: ProgressStatus
}

async function getNextLevel(
  db: ReturnType<typeof createServiceClient>,
  currentOrder: number | null
): Promise<XpLevel | null> {
  if (currentOrder == null) return null
  const { data } = await db
    .from('xp_levels')
    .select('*')
    .gt('order_num', currentOrder)
    .order('order_num', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as XpLevel) ?? null
}

export default async function StudyPage() {
  const session = await getStudentSession()
  if (!session) redirect('/learn/login')

  const db = createServiceClient()
  const { data: student } = await db
    .from('students')
    .select('language')
    .eq('id', session.studentId)
    .maybeSingle()

  const language: Language = (student as any)?.language ?? session.language ?? 'ru'
  const t = tr[language]

  const stats = await ensureStudentStats(db, session.studentId)
  const level = await getLevelForXp(db, stats.total_xp)
  const nextLevel = await getNextLevel(db, level?.order_num ?? null)

  const course = await getActiveCourse(db)

  const levelName = level ? (language === 'kz' ? level.name_kz : level.name_ru) : '—'
  const currentMin = level?.min_xp ?? 0
  const nextMin = nextLevel?.min_xp ?? null
  const xpInLevel = Math.max(0, stats.total_xp - currentMin)
  const xpNeeded = nextMin != null ? Math.max(1, nextMin - currentMin) : 0
  const xpPercent =
    nextMin == null ? 100 : Math.min(100, Math.round((xpInLevel / xpNeeded) * 100))

  let rows: TopicRow[] = []
  if (course) {
    const { topics, progress } = await getOrInitProgress(db, session.studentId, course.id)
    rows = topics.map(tp => {
      const p = progress.find(pp => pp.topic_id === tp.id)
      return {
        id: tp.id,
        title_ru: tp.title_ru,
        title_kz: tp.title_kz,
        order_num: tp.order_num,
        status: (p?.status ?? 'locked') as ProgressStatus,
      }
    })
  }

  const completedCount = rows.filter(r => r.status === 'completed').length
  const totalTopics = rows.length
  const coursePercent =
    totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0
  const percentColor = coursePercent >= 50 ? '#1ec8c8' : '#f47920'
  const courseTitle = course ? (language === 'kz' ? course.title_kz : course.title_ru) : ''
  const courseIcon = course?.icon ?? '🔢'

  return (
    <div className="space-y-5">
      {/* XP bar card */}
      <section className="cab-card">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-unbounded text-[14px] font-semibold text-cab-text">
              <span className="mr-1.5">{level?.icon ?? '⭐'}</span>
              {t.level} {level?.order_num ?? 1}
              <span className="ml-1.5 font-geologica text-[12px] font-normal text-cab-muted">
                · {levelName}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 font-unbounded text-[12px] font-bold text-cab-teal">
            {stats.total_xp}
            <span className="text-cab-muted"> / {nextMin ?? stats.total_xp}</span>
            <span className="ml-1 font-geologica text-[11px] font-normal text-cab-muted">
              {t.xp}
            </span>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${xpPercent}%`,
              background: 'linear-gradient(90deg, var(--teal), #5eeaea)',
              boxShadow: '0 0 10px rgba(30,200,200,0.4)',
              transition: 'width 700ms ease-out',
            }}
          />
        </div>
        {nextMin == null && (
          <div className="mt-2 font-geologica text-[11px] text-cab-muted">
            {t.maxLevel}
          </div>
        )}
      </section>

      {/* Section header */}
      <header>
        <p className="font-geologica text-[11px] font-semibold uppercase tracking-[2.5px] text-cab-muted">
          {t.subtitle}
        </p>
      </header>

      {!course ? (
        <div className="cab-card text-center font-geologica text-[13px] text-cab-muted">
          {t.noCourse}
        </div>
      ) : rows.length === 0 ? (
        <div className="cab-card text-center font-geologica text-[13px] text-cab-muted">
          {t.noTopics}
        </div>
      ) : (
        <section
          className="rounded-[18px] border border-white/5 bg-cab-card p-5"
        >
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-[14px] text-[24px]"
              style={{ background: 'rgba(30,200,200,0.12)' }}
            >
              {courseIcon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-geologica text-[15px] font-semibold text-cab-text">
                {courseTitle}
              </div>
              <div className="mt-0.5 truncate font-geologica text-[12px] text-cab-muted">
                {t.topicsDone(completedCount, totalTopics)}
              </div>
            </div>
            <div
              className="flex-shrink-0 font-unbounded text-[18px] font-bold leading-none"
              style={{ color: percentColor }}
            >
              {coursePercent}%
            </div>
          </div>

          <div
            className="mt-4 h-[6px] w-full overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${coursePercent}%`,
                background: 'linear-gradient(90deg, #1ec8c8, #f47920)',
                boxShadow: '0 0 10px rgba(30,200,200,0.4)',
                transition: 'width 700ms ease-out',
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {rows.map(topic => (
              <TopicPill key={topic.id} topic={topic} language={language} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TopicPill({ topic, language }: { topic: TopicRow; language: Language }) {
  const title = language === 'kz' ? topic.title_kz : topic.title_ru
  const isLocked = topic.status === 'locked'
  const isDone = topic.status === 'completed'

  const style: React.CSSProperties = isDone
    ? {
        background: 'rgba(34,197,94,0.12)',
        color: '#22c55e',
        border: '1px solid rgba(34,197,94,0.2)',
      }
    : isLocked
      ? {
          background: 'rgba(255,255,255,0.05)',
          color: '#6b7280',
          border: '1px solid rgba(255,255,255,0.08)',
        }
      : {
          background: 'rgba(30,200,200,0.12)',
          color: '#1ec8c8',
          border: '1px solid rgba(30,200,200,0.25)',
        }

  const icon = isDone ? '✅' : isLocked ? '🔒' : '▶'
  const cls =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-geologica text-[11px] font-medium transition'

  if (isLocked) {
    return (
      <span className={cls} style={style}>
        <span aria-hidden>{icon}</span>
        <span>{title}</span>
      </span>
    )
  }
  return (
    <Link
      href={`/learn/topic/${topic.id}`}
      className={`${cls} hover:brightness-110`}
      style={style}
    >
      <span aria-hidden>{icon}</span>
      <span>{title}</span>
    </Link>
  )
}
