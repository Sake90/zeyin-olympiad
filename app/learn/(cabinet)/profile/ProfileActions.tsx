'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { Language } from '@/lib/supabase'

const tr = {
  ru: {
    language: 'Язык / Тіл',
    logout: 'Выйти',
    saving: 'Сохранение…',
    chooseLang: 'Выбери язык',
  },
  kz: {
    language: 'Тіл / Язык',
    logout: 'Шығу',
    saving: 'Сақталуда…',
    chooseLang: 'Тілді таңда',
  },
} as const

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px] text-cab-muted"
      aria-hidden
    >
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[20px] w-[20px]" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[20px] w-[20px]" aria-hidden>
      <path
        d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 8 6 12l4 4M6 12h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProfileActions({ currentLanguage }: { currentLanguage: Language }) {
  const router = useRouter()
  const [language, setLanguage] = useState<Language>(currentLanguage)
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const t = tr[language]

  async function changeLanguage(next: Language) {
    if (next === language) {
      setOpen(false)
      return
    }
    setSaving(true)
    setLanguage(next)
    const res = await fetch('/api/learn/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: next }),
    })
    setSaving(false)
    setOpen(false)
    if (res.ok) {
      startTransition(() => router.refresh())
    } else {
      setLanguage(language)
    }
  }

  async function logout() {
    await fetch('/api/learn/profile', { method: 'DELETE' })
    router.replace('/learn/login')
  }

  return (
    <section className="cab-card !p-0 overflow-hidden">
      {/* Language item */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
      >
        <span className="text-cab-teal">
          <GlobeIcon />
        </span>
        <span className="flex-1 font-geologica text-[14px] text-cab-text">
          {t.language}
        </span>
        <span className="font-geologica text-[13px] text-cab-muted">
          {language === 'ru' ? 'Русский' : 'Қазақша'}
        </span>
        <ChevronRight />
      </button>

      {open && (
        <div className="border-t border-cab-teal/10 bg-black/20 px-5 py-3">
          <div className="mb-2 font-geologica text-[11px] uppercase tracking-wider text-cab-muted">
            {t.chooseLang}
          </div>
          <div className="flex gap-2">
            {(['ru', 'kz'] as Language[]).map(opt => (
              <button
                key={opt}
                onClick={() => changeLanguage(opt)}
                disabled={saving || isPending}
                className={`flex-1 rounded-full px-4 py-2 font-geologica text-[13px] transition ${
                  language === opt
                    ? 'cab-pill-active font-semibold'
                    : 'border border-white/10 text-cab-muted hover:text-cab-text'
                }`}
              >
                {opt === 'ru' ? 'Русский' : 'Қазақша'}
              </button>
            ))}
          </div>
          {saving && (
            <div className="mt-2 font-geologica text-[11px] text-cab-muted">
              {t.saving}
            </div>
          )}
        </div>
      )}

      {/* Logout item */}
      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center gap-3 border-t border-cab-teal/10 px-5 py-4 text-left transition hover:bg-white/[0.02]"
        style={{ color: 'var(--magenta)' }}
      >
        <span>
          <LogoutIcon />
        </span>
        <span className="flex-1 font-geologica text-[14px] font-semibold">
          {t.logout}
        </span>
        <ChevronRight />
      </button>
    </section>
  )
}
