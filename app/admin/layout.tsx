'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import ZeyinLogo from '@/components/ZeyinLogo'
import { ToastProvider } from '@/components/admin/Toast'

type NavItem = { href: string; label: string; icon: string }
type NavGroup = { label: string; icon: string; basePath: string; children: NavItem[] }
type NavEntry = NavItem | NavGroup

function isGroup(e: NavEntry): e is NavGroup {
  return 'children' in e
}

const NAV: NavEntry[] = [
  { href: '/admin', label: 'Дашборд', icon: '◈' },
  { href: '/admin/olympiads', label: 'Олимпиады', icon: '🏆' },
  { href: '/admin/students', label: 'Ученики', icon: '👤' },
  { href: '/admin/questions', label: 'Вопросы', icon: '?' },
  { href: '/admin/results', label: 'Результаты', icon: '📊' },
  { href: '/admin/courses', label: 'Курсы', icon: '📚' },
  {
    label: 'Тренажер', icon: '🎯', basePath: '/admin/trainer',
    children: [
      { href: '/admin/trainer/students', label: 'Ученики', icon: '·' },
      { href: '/admin/trainer/tests',    label: 'Тесты',   icon: '·' },
      { href: '/admin/trainer/settings', label: 'Настройки', icon: '·' },
    ],
  },
  { href: '/admin/settings', label: 'Настройки', icon: '⚙️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/admin', { method: 'DELETE' })
    router.push('/admin/login')
  }

  return (
    <ToastProvider>
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
          {NAV.map(entry => {
            if (isGroup(entry)) {
              const groupActive = pathname.startsWith(entry.basePath)
              return (
                <div key={entry.label} className="flex flex-col gap-1">
                  <div
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
                    style={{
                      background: groupActive ? 'rgba(30,200,200,0.06)' : 'transparent',
                      color: groupActive ? '#1ec8c8' : '#6b7280',
                    }}
                  >
                    <span className="text-base">{entry.icon}</span>
                    {entry.label}
                  </div>
                  <div className="ml-4 flex flex-col gap-1 border-l border-gray-100 pl-2">
                    {entry.children.map(child => {
                      const active = pathname === child.href ||
                        pathname.startsWith(child.href + '/')
                      return (
                        <Link key={child.href} href={child.href}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all"
                          style={{
                            background: active ? 'rgba(30,200,200,0.1)' : 'transparent',
                            color: active ? '#1ec8c8' : '#6b7280',
                          }}>
                          <span className="text-gray-300">{child.icon}</span>
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            }

            const item = entry
            const active = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href + '/'))
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
    </ToastProvider>
  )
}
