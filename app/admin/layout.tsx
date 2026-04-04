'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import ZeyinLogo from '@/components/ZeyinLogo'

const NAV = [
  { href: '/admin', label: 'Дашборд', icon: '◈' },
  { href: '/admin/olympiads', label: 'Олимпиады', icon: '🏆' },
  { href: '/admin/students', label: 'Ученики', icon: '👤' },
  { href: '/admin/questions', label: 'Вопросы', icon: '?' },
  { href: '/admin/results', label: 'Результаты', icon: '📊' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/admin', { method: 'DELETE' })
    router.push('/admin/login')
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#f5f7fa', color: '#1a1a1a' }}>
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full p-0.5"
            style={{ background: 'conic-gradient(#1ec8c8 0deg, #d4145a 180deg, #f47920 300deg, #1ec8c8 360deg)' }}>
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0a1f1e]">
              <ZeyinLogo size={22} />
            </div>
          </div>
          <div>
            <div className="text-xs font-black text-[#1ec8c8]">ZEYIN</div>
            <div className="font-mono text-[9px] text-gray-400">Admin Panel</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(item => {
            const active = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                style={{
                  background: active ? 'rgba(30,200,200,0.1)' : 'transparent',
                  color: active ? '#1ec8c8' : '#6b7280',
                  borderLeft: active ? '2px solid #1ec8c8' : '2px solid transparent',
                }}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-200 p-3">
          <button onClick={handleLogout}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-400 transition-all hover:border-red-300 hover:text-red-500">
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
