'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  fullName: string
  classLabel: string
}

export default function TrainerHomeClient({ fullName, classLabel }: Props) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/trainer/auth/login', { method: 'DELETE' })
    router.push('/trainer/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="text-xs font-mono text-gray-400">Тренажер · {classLabel}</div>
        <h1 className="mt-2 text-2xl font-black text-gray-800">Привет, {fullName}!</h1>
        <p className="mt-3 text-sm text-gray-500">
          Каталог тестов появится в следующей сессии.
        </p>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-6 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-all hover:border-red-300 hover:text-red-500 disabled:opacity-60"
        >
          {loggingOut ? 'Выход...' : 'Выйти'}
        </button>
      </div>
    </div>
  )
}
