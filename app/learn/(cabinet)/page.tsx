import Link from 'next/link'
import { getStudentSession } from '@/lib/auth'
import { createServiceClient, type Language, type ProgressStatus } from '@/lib/supabase'
import {
  ensureStudentStats,
  getActiveCourse,
  getLevelForXp,
  getOrInitProgress,
} from '@/lib/learn'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const tr = {
  ru: {
    hello: 'Привет',
    helloLong: 'Привет 👋',
    streakShort: 'дн.',
    streakDesc: 'Занимайся каждый день чтобы не потерять серию',
    streakTitle: 'дней подряд — так держать!',
    streakTitleZero: 'Начни серию сегодня!',
    xp: 'XP',
    topicsDone: 'тем закрыто',
    level: 'Уровень',
    continueTitle: 'Продолжи с того места',
    continue: 'Продолжить',
    goStudy: 'Начать учёбу →',
    noCourse: 'Курс ещё не назначен. Загляни позже.',
    subjectDefault: 'Курс',
    week: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  },
  kz: {
    hello: 'Сәлем',
    helloLong: 'Сәлем, қайырлы күн 👋',
    streakShort: 'күн',
    streakDesc: 'Сериядан айырылмас үшін күнде айналыс',
    streakTitle: 'күн қатарынан — осылай жалғастыр!',
    streakTitleZero: 'Бүгін серияңды баста!',
    xp: 'XP',
    topicsDone: 'аяқталған тақырып',
    level: 'Деңгей',
    continueTitle: 'Қалдырған жеріңнен жалғастыр',
    continue: 'Жалғастыру',
    goStudy: 'Оқуды бастау →',
    noCourse: 'Курс әлі тағайындалмаған. Кейін кіріп көр.',
    subjectDefault: 'Курс',
    week: ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс'],
  },
} as const

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildWeek(
  lastActivity: string | null,
  streak: number
): { label: string; iso: string; isToday: boolean; isDone: boolean; isFuture: boolean }[] {
  const today = new Date()
  const dow = today.getDay()
  const mondayOffset = dow === 0 ? 6 : dow - 1
  const monday = new Date(today)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(today.getDate() - mondayOffset)

  const active = new Set<string>()
  if (lastActivity && streak > 0) {
    const last = new Date(lastActivity + 'T00:00:00')
    for (let i = 0; i < streak; i++) {
      const d = new Date(last)
      d.setDate(last.getDate() - i)
      active.add(toISODate(d))
    }
  }

  const todayIso = toISODate(today)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = toISODate(d)
    return {
      label: '',
      iso,
      isToday: iso === todayIso,
      isDone: active.has(iso),
      isFuture: iso > todayIso,
    }
  })
}

export default async function LearnHomePage() {
  const session = await getStudentSession()
  if (!session) redirect('/learn/login')

  const db = createServiceClient()

  const { data: student } = await db
    .from('students')
    .select('id, full_name, language')
    .eq('id', session.studentId)
    .maybeSingle()

  const language: Language = (student as any)?.language ?? session.language ?? 'ru'
  const t = tr[language]
  const firstName = ((student as any)?.full_name ?? '').split(' ')[0] ?? ''

  const stats = await ensureStudentStats(db, session.studentId)
  const level = await getLevelForXp(db, stats.total_xp)

  const course = await getActiveCourse(db)

  let continueTopic: { id: string; title: string } | null = null
  let completedCount = 0
  let totalTopics = 0
  if (course) {
    const { topics, progress } = await getOrInitProgress(db, session.studentId, course.id)
    totalTopics = topics.length
    completedCount = progress.filter(p => p.status === 'completed').length
    const statusOf = (tid: string): ProgressStatus =>
      (progress.find(pp => pp.topic_id === tid)?.status ?? 'locked') as ProgressStatus
    const candidate =
      topics.find(tp => statusOf(tp.id) === 'in_progress') ??
      topics.find(tp => statusOf(tp.id) === 'available')
    if (candidate) {
      continueTopic = {
        id: candidate.id,
        title: language === 'kz' ? candidate.title_kz : candidate.title_ru,
      }
    }
  }

  const courseTitle = course ? (language === 'kz' ? course.title_kz : course.title_ru) : t.subjectDefault
  const week = buildWeek(stats.last_activity_date, stats.current_streak)
  const weekLabels = t.week
  const coursePercent = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <section
        className="rounded-[20px] border p-[22px]"
        style={{
          background:
            'linear-gradient(135deg, rgba(30,200,200,0.10), rgba(212,20,90,0.06))',
          borderColor: 'rgba(30,200,200,0.2)',
        }}
      >
        <div className="font-geologica text-[13px] text-cab-muted">{t.helloLong}</div>
        <h1 className="mt-1 font-unbounded text-[20px] font-bold leading-tight text-cab-text">
          {firstName || '👋'}
        </h1>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat
            value={stats.total_xp}
            label={t.xp}
            color="var(--teal)"
          />
          <Stat
            value={
              <span className="inline-flex items-center gap-1">
                <span>🔥</span>
                <span>{stats.current_streak}</span>
              </span>
            }
            label={t.streakShort}
            color="var(--orange)"
          />
          <Stat
            value={`${completedCount}`}
            label={t.topicsDone}
            color="var(--green)"
            hint={totalTopics > 0 ? `/ ${totalTopics}` : undefined}
          />
        </div>
      </section>

      {/* Streak card */}
      <section className="cab-card">
        <div className="flex items-start gap-3">
          <div className="text-[32px] leading-none">🔥</div>
          <div className="min-w-0 flex-1">
            <div className="font-geologica text-[13px] font-semibold text-cab-text">
              {stats.current_streak > 0
                ? `${stats.current_streak} ${t.streakTitle}`
                : t.streakTitleZero}
            </div>
            <div className="mt-0.5 font-geologica text-[12px] text-cab-muted">
              {t.streakDesc}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {week.map((d, i) => {
            const style: React.CSSProperties = d.isToday
              ? { background: '#1ec8c8', color: '#0a0d14' }
              : d.isDone
                ? {
                    background: 'rgba(30,200,200,0.15)',
                    color: '#1ec8c8',
                    border: '1px solid rgba(30,200,200,0.25)',
                  }
                : {
                    background: 'rgba(255,255,255,0.05)',
                    color: '#6b7280',
                  }
            return (
              <div key={i} className="flex items-center justify-center">
                <span
                  className="grid h-9 w-9 place-items-center rounded-lg font-geologica text-[11px] font-semibold uppercase tracking-wide"
                  style={style}
                >
                  {weekLabels[i]}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Continue section */}
      {course ? (
        <section>
          <div className="mb-2.5 font-geologica text-[11px] font-semibold uppercase tracking-[2.5px] text-cab-muted">
            {t.continueTitle}
          </div>

          {continueTopic ? (
            <Link
              href={`/learn/topic/${continueTopic.id}`}
              className="flex items-center gap-3 rounded-[16px] border border-cab-teal/10 bg-cab-card p-3 transition hover:border-cab-teal/30"
            >
              <div
                className="grid h-[46px] w-[46px] flex-shrink-0 place-items-center rounded-[12px] text-[22px]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(30,200,200,0.18), rgba(15,168,168,0.08))',
                  border: '1px solid rgba(30,200,200,0.25)',
                }}
              >
                📘
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-geologica text-[11px] text-cab-muted">
                  {courseTitle}
                </div>
                <div className="truncate font-geologica text-[14px] font-semibold text-cab-text">
                  {continueTopic.title}
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${coursePercent}%`,
                      background:
                        'linear-gradient(90deg, #d4145a, #e8206e)',
                      boxShadow: '0 0 8px rgba(212,20,90,0.4)',
                    }}
                  />
                </div>
                <div className="mt-1 font-geologica text-[11px] text-cab-muted">
                  {coursePercent}% {language === 'kz' ? 'аяқталды' : 'пройдено'}
                </div>
              </div>
              <span className="font-unbounded text-[22px] text-cab-muted">›</span>
            </Link>
          ) : (
            <Link
              href="/learn/study"
              className="cab-btn-primary block px-6 py-4 text-center text-[14px]"
            >
              {t.goStudy}
            </Link>
          )}
        </section>
      ) : (
        <div className="cab-card text-center font-geologica text-[13px] text-cab-muted">
          {t.noCourse}
        </div>
      )}
    </div>
  )
}

function Stat({
  value,
  label,
  color,
  hint,
}: {
  value: React.ReactNode
  label: string
  color: string
  hint?: string
}) {
  return (
    <div className="min-w-0">
      <div
        className="truncate font-unbounded text-[20px] font-bold leading-none"
        style={{ color }}
      >
        {value}
        {hint ? (
          <span className="ml-1 text-[13px] font-normal text-cab-muted">{hint}</span>
        ) : null}
      </div>
      <div className="mt-1.5 truncate font-geologica text-[11px] text-cab-muted">
        {label}
      </div>
    </div>
  )
}
