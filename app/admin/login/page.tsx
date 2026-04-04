'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ZeyinLogo from '@/components/ZeyinLogo'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) router.push('/admin')
      else setError('Неверный пароль')
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full p-0.5"
            style={{ background: 'conic-gradient(#1ec8c8 0deg, #d4145a 180deg, #f47920 300deg, #1ec8c8 360deg)' }}>
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0a1f1e]">
              <ZeyinLogo size={30} />
            </div>
          </div>
          <div className="text-center">
            <div className="font-black text-[#1ec8c8]">ZEYIN Admin</div>
            <div className="text-xs text-gray-400">Панель управления</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="password" placeholder="Пароль администратора"
            value={password} onChange={e => setPassword(e.target.value)} required
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]" />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading}
            className="rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
