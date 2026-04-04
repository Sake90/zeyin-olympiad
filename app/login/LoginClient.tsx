'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OlympiadHeader from '@/components/OlympiadHeader'

export default function LoginClient({ name_ru, name_kz }: { name_ru: string; name_kz: string }) {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [language, setLanguage] = useState<'ru' | 'kz'>('kz')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const t = {
    ru: {
      title: 'Вход в олимпиаду',
      loginPlaceholder: 'Логин',
      passwordPlaceholder: 'Пароль',
      submit: 'Войти',
      loading: 'Вход...',
    },
    kz: {
      title: 'Олимпиадаға кіру',
      loginPlaceholder: 'Логин',
      passwordPlaceholder: 'Құпия сөз',
      submit: 'Кіру',
      loading: 'Жүктелуде...',
    },
  }[language]

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

  return (
    <div className="phone-bg"
      style={{ background: 'radial-gradient(ellipse at top left, #061a1a 0%, #06100f 60%)' }}>
      <div className="phone-card relative mx-auto">

        <OlympiadHeader
          typewriter
          banner="/banner-login.jpg"
          title={language === 'kz' ? name_kz : name_ru}
        />

        <div className="flex flex-1 flex-col px-5 pb-8 pt-4">
          <div className="mb-6 flex overflow-hidden rounded-xl border border-zeyin-border">
            {(['kz', 'ru'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className="flex-1 py-3 text-sm font-bold transition-all"
                style={{
                  background: language === lang
                    ? 'linear-gradient(135deg, #0fa8a8, #1ec8c8)'
                    : '#0c1a19',
                  color: language === lang ? '#06100f' : '#4a7070',
                }}>
                {lang === 'ru' ? 'Русская группа' : 'Қазақ тобы'}
              </button>
            ))}
          </div>

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
            <input
              type="password"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="rounded-2xl border border-zeyin-border bg-zeyin-card px-4 py-4 text-base text-[#b2e8e8] placeholder-[#1a3030] outline-none transition-all focus:border-zeyin-teal"
            />

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
