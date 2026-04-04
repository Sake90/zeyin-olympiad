'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Stats {
  olympiads: number
  students: number
  active: string | null
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ olympiads: 0, students: 0, active: null })

  useEffect(() => {
    async function load() {
      try {
        const [oRes, sRes] = await Promise.all([
          fetch('/api/admin/olympiads'),
          fetch('/api/admin/students?limit=1'),
        ])
        const olympiads = await oRes.json()
        const sData = await sRes.json()
        const active = Array.isArray(olympiads)
          ? (olympiads.find((o: { status: string; name_ru: string }) => o.status === 'active')?.name_ru ?? null)
          : null
        setStats({
          olympiads: Array.isArray(olympiads) ? olympiads.length : 0,
          students: sData.total ?? 0,
          active,
        })
      } catch { /* ignore */ }
    }
    load()
  }, [])

  const cards = [
    { label: 'Олимпиады', value: stats.olympiads, href: '/admin/olympiads', color: '#1ec8c8', icon: '🏆' },
    { label: 'Ученики', value: stats.students, href: '/admin/students', color: '#e8206e', icon: '👤' },
    { label: 'Активная', value: stats.active ?? '—', href: '/admin/olympiads', color: '#f47920', icon: '▶' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-black text-gray-800">Панель управления</h1>

      <div className="mb-8 grid grid-cols-3 gap-4">
        {cards.map(c => (
          <Link key={c.label} href={c.href}
            className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <span className="text-2xl">{c.icon}</span>
            <span className="font-mono text-2xl font-black" style={{ color: c.color }}>
              {c.value}
            </span>
            <span className="text-sm text-gray-500">{c.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { href: '/admin/students', label: 'Управление учениками', sub: 'Добавить, импортировать Excel, выдать пароли', icon: '👤' },
          { href: '/admin/olympiads', label: 'Создать олимпиаду', sub: 'Настроить параметры и расписание', icon: '🏆' },
          { href: '/admin/questions', label: 'Загрузить вопросы', sub: 'Тесты, видеовопросы, задачи', icon: '?' },
          { href: '/admin/results', label: 'Результаты', sub: 'Таблица, фильтры, экспорт Excel', icon: '📊' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-[#1ec8c8] hover:shadow-md">
            <span className="mt-0.5 text-xl">{item.icon}</span>
            <div>
              <div className="font-semibold text-gray-800">{item.label}</div>
              <div className="mt-0.5 text-xs text-gray-400">{item.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
