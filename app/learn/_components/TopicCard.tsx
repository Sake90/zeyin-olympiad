import Link from 'next/link'
import type { Language, ProgressStatus } from '@/lib/supabase'

type TopicRow = {
  id: string
  title_ru: string
  title_kz: string
  order_num: number
  status: ProgressStatus
}

const labels = {
  ru: {
    topic: 'Тема',
    locked: 'Закрыто',
    available: 'Доступно',
    in_progress: 'В процессе',
    completed: 'Пройдено',
    skipped: 'Пропущено',
  },
  kz: {
    topic: 'Тақырып',
    locked: 'Жабық',
    available: 'Қолжетімді',
    in_progress: 'Орындалуда',
    completed: 'Аяқталды',
    skipped: 'Өткізілді',
  },
} as const

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden>
      <path
        d="M5 12.5 10 17 19 7.5"
        stroke="#0a0d14"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[16px] w-[16px]" aria-hidden>
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function StatusDot({ status }: { status: ProgressStatus }) {
  if (status === 'completed') {
    return (
      <span
        className="grid h-8 w-8 place-items-center rounded-full"
        style={{
          background: 'var(--green)',
          boxShadow: '0 0 12px rgba(34,197,94,0.4)',
        }}
      >
        <CheckIcon />
      </span>
    )
  }
  if (status === 'available' || status === 'in_progress') {
    return (
      <span
        className="grid h-8 w-8 place-items-center rounded-full animate-cab-pulse"
        style={{
          background: 'linear-gradient(135deg, var(--teal), #0fa8a8)',
          boxShadow: '0 0 12px rgba(30,200,200,0.5)',
        }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: '#0a0d14' }}
        />
      </span>
    )
  }
  return (
    <span
      className="grid h-8 w-8 place-items-center rounded-full text-cab-muted"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <LockIcon />
    </span>
  )
}

export function TopicCard({ topic, language }: { topic: TopicRow; language: Language }) {
  const title = language === 'kz' ? topic.title_kz : topic.title_ru
  const isLocked = topic.status === 'locked'
  const t = labels[language]

  const statusLabel = t[topic.status as keyof typeof t] ?? ''

  const pill =
    topic.status === 'completed'
      ? 'cab-pill-done'
      : topic.status === 'locked'
        ? 'cab-pill-locked'
        : 'cab-pill-active'

  const content = (
    <div
      className={`flex items-center gap-4 rounded-[16px] border p-4 transition ${
        isLocked
          ? 'border-white/5 bg-white/[0.02] opacity-70'
          : 'border-cab-teal/10 bg-cab-card hover:border-cab-teal/30'
      }`}
    >
      <StatusDot status={topic.status} />
      <div className="min-w-0 flex-1">
        <div className="font-geologica text-[11px] font-medium uppercase tracking-[1.5px] text-cab-muted">
          {t.topic} {topic.order_num}
        </div>
        <div className="truncate font-geologica text-[14px] font-semibold text-cab-text">
          {title}
        </div>
      </div>
      <span
        className={`${pill} whitespace-nowrap px-2.5 py-1 font-geologica text-[10px] font-semibold`}
      >
        {statusLabel}
      </span>
    </div>
  )

  if (isLocked) return content
  return <Link href={`/learn/topic/${topic.id}`}>{content}</Link>
}
