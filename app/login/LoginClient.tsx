'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OlympiadHeader from '@/components/OlympiadHeader'

type Olympiad = { id: string; name_ru: string; name_kz: string }

export default function LoginClient({ olympiads }: { olympiads: Olympiad[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Olympiad | null>(
    olympiads.length === 1 ? olympiads[0] : null
  )
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Двуязычные подписи: kz / ru вместе на странице входа.
  // Реальный язык теста ученика берётся из БД после входа.
  const t = {
    title: 'Олимпиадаға кіру / Вход на олимпиаду',
    loginPlaceholder: 'Логин',
    passwordPlaceholder: 'Құпия сөз / Пароль',
    submit: 'Кіру / Войти',
    loading: 'Жүктелуде... / Вход...',
    pick: 'Олимпиаданы таңдаңыз / Выберите олимпиаду',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Ошибка входа')
      } else {
        router.push('/intro')
      }
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  // ── Выбор олимпиады (если их несколько и ещё не выбрана) ───────
  if (!selected) {
    return (
      <div className="phone-bg"
        style={{ background: 'radial-gradient(ellipse at top left, #061a1a 0%, #06100f 60%)' }}>
        <div className="phone-card relative mx-auto">
          <OlympiadHeader banner="/banner-login.jpg" />

          <div className="flex flex-1 flex-col px-5 pb-8 pt-4">
            <h1 className="mb-5 text-center text-lg font-black text-[#b2e8e8]">
              {t.pick}
            </h1>

            <div className="flex flex-col gap-3">
              {olympiads.map(o => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="rounded-2xl border border-zeyin-border bg-zeyin-card px-5 py-4 text-left text-base font-bold text-[#b2e8e8] transition-all hover:border-zeyin-teal">
                  {o.name_kz}
                </button>
              ))}
            </div>

            <div className="mt-auto pt-8 text-center font-mono text-[13px] uppercase"
              style={{ color: '#1ec8c8' }}>
              ZEYIN OQU ORTALYGY • 2026
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Форма входа ────────────────────────────────────────────────
  return (
    <div className="phone-bg"
      style={{ background: 'radial-gradient(ellipse at top left, #061a1a 0%, #06100f 60%)' }}>
      <div className="phone-card relative mx-auto">

        <OlympiadHeader
          typewriter
          banner="/banner-login.jpg"
          title={selected.name_kz}
        />

        <div className="flex flex-1 flex-col px-5 pb-8 pt-4">
          {olympiads.length > 1 && (
            <button
              onClick={() => setSelected(null)}
              className="mb-4 text-left text-sm"
              style={{ color: '#4a7070' }}>
              ← {t.pick}
            </button>
          )}

          <h1 className="mb-5 text-center text-lg font-black text-[#b2e8e8]">
            {t.title}
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={t.loginPlaceholder}
              value={login}
              onChange={e => setLogin(e.target.value)}
              required
              className="rounded-2xl border border-zeyin-border bg-zeyin-card px-4 py-4 text-base text-[#b2e8e8] placeholder-[#1a3030] outline-none transition-all focus:border-zeyin-teal"
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-zeyin-border bg-zeyin-card px-4 py-4 pr-14 text-base text-[#b2e8e8] placeholder-[#1a3030] outline-none transition-all focus:border-zeyin-teal"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-lg transition-colors"
                style={{ color: showPassword ? '#1ec8c8' : '#4a7070' }}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-2xl py-4 text-base font-bold text-zeyin-bg transition-all disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)',
                boxShadow: '0 6px 20px rgba(30,200,200,0.27)',
              }}>
              {loading ? t.loading : t.submit}
            </button>
          </form>

          <div className="mt-auto pt-8 text-center font-mono text-[13px] uppercase"
            style={{ color: '#1ec8c8' }}>
            ZEYIN OQU ORTALYGY • 2026
          </div>
        </div>
      </div>
    </div>
  )
}
