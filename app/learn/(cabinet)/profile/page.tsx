import { redirect } from 'next/navigation'
import { getStudentSession } from '@/lib/auth'
import { createServiceClient, type Language } from '@/lib/supabase'
import { ensureStudentStats, getLevelForXp } from '@/lib/learn'
import { ProfileActions } from './ProfileActions'

export const dynamic = 'force-dynamic'

const tr = {
  ru: {
    classSuffix: 'класс',
    streakPill: 'дней подряд',
    topicsLabel: 'тем закрыто',
    xpLabel: 'XP набрано',
    correctLabel: 'правильных',
    maxStreakLabel: 'стрик макс',
    dashSchoolPrefix: '',
  },
  kz: {
    classSuffix: 'сынып',
    streakPill: 'күн қатарынан',
    topicsLabel: 'аяқталған тақырып',
    xpLabel: 'XP жинадың',
    correctLabel: 'дұрыс жауап',
    maxStreakLabel: 'ең ұзын серия',
    dashSchoolPrefix: '',
  },
} as const

function getInitial(name: string | null | undefined): string {
  if (!name) return '?'
  const first = name.trim().split(/\s+/)[0] ?? ''
  return first.charAt(0).toUpperCase() || '?'
}

export default async function ProfilePage() {
  const session = await getStudentSession()
  if (!session) redirect('/learn/login')

  const db = createServiceClient()
  const { data: student } = await db
    .from('students')
    .select('id, full_name, school, grade, language, login')
    .eq('id', session.studentId)
    .maybeSingle()

  const language: Language = (student as any)?.language ?? session.language ?? 'ru'
  const t = tr[language]

  const stats = await ensureStudentStats(db, session.studentId)
  const level = await getLevelForXp(db, stats.total_xp)

  const { count: completedCount } = await db
    .from('student_progress')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', session.studentId)
    .eq('status', 'completed')

  const { data: scored } = await db
    .from('student_progress')
    .select('score')
    .eq('student_id', session.studentId)
    .eq('status', 'completed')
    .not('score', 'is', null)

  const scores = (scored as { score: number | null }[] | null) ?? []
  const avgScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((acc, r) => acc + (r.score ?? 0), 0) / scores.length
        )
      : 0

  const fullName = ((student as any)?.full_name ?? '') as string
  const grade = ((student as any)?.grade ?? '') as string
  const school = ((student as any)?.school ?? '') as string
  const initial = getInitial(fullName)

  const subtitleParts = [
    grade ? `${grade} ${t.classSuffix}` : '',
    school ? school : '',
  ].filter(Boolean)
  const subtitle = subtitleParts.join(' · ')
  const levelName = level ? (language === 'kz' ? level.name_kz : level.name_ru) : ''

  return (
    <div className="space-y-5">
      {/* Avatar hero */}
      <section className="flex flex-col items-center text-center">
        <div
          className="grid h-[72px] w-[72px] place-items-center rounded-full font-unbounded text-[26px] font-bold text-[#0a0d14]"
          style={{
            background: 'linear-gradient(135deg, #1ec8c8, #0fa8a8)',
            boxShadow: '0 0 24px rgba(30,200,200,0.3)',
          }}
        >
          {initial}
        </div>
        <h1 className="mt-3 font-unbounded text-[18px] font-bold leading-tight text-cab-text">
          {fullName || '—'}
        </h1>
        {subtitle && (
          <p className="mt-1 font-geologica text-[13px] text-cab-muted">{subtitle}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span
            className="font-geologica text-[12px] font-semibold"
            style={{
              background: 'rgba(30,200,200,0.08)',
              border: '1px solid rgba(30,200,200,0.2)',
              color: 'var(--teal)',
              borderRadius: 99,
              padding: '6px 14px',
            }}
          >
            🔥 {stats.current_streak} {t.streakPill}
          </span>
          <span
            className="font-geologica text-[12px] font-semibold"
            style={{
              background: 'rgba(30,200,200,0.08)',
              border: '1px solid rgba(30,200,200,0.2)',
              color: 'var(--teal)',
              borderRadius: 99,
              padding: '6px 14px',
            }}
          >
            {level?.icon ?? '⭐'} {stats.total_xp} XP
          </span>
        </div>
        {levelName && (
          <div className="mt-2 font-geologica text-[11px] text-cab-muted">
            {levelName}
          </div>
        )}
      </section>

      {/* 2x2 stat grid */}
      <section className="grid grid-cols-2 gap-3">
        <StatCell
          value={completedCount ?? 0}
          label={t.topicsLabel}
          color="var(--teal)"
        />
        <StatCell
          value={stats.total_xp}
          label={t.xpLabel}
          color="var(--orange)"
        />
        <StatCell
          value={`${avgScore}%`}
          label={t.correctLabel}
          color="var(--green)"
        />
        <StatCell
          value={stats.max_streak}
          label={t.maxStreakLabel}
          color="var(--magenta)"
        />
      </section>

      {/* Menu list */}
      <ProfileActions currentLanguage={language} />
    </div>
  )
}

function StatCell({
  value,
  label,
  color,
}: {
  value: React.ReactNode
  label: string
  color: string
}) {
  return (
    <div className="cab-card">
      <div
        className="font-unbounded text-[24px] font-bold leading-none"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-2 font-geologica text-[11px] text-cab-muted">{label}</div>
    </div>
  )
}
