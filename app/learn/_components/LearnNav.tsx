'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Language } from '@/lib/supabase'

type TabIcon = (active: boolean) => React.ReactNode
type Tab = { href: string; labelRu: string; labelKz: string; icon: TabIcon }

const ICON_COMMON = 'h-[22px] w-[22px] transition'

function HomeIcon(active: boolean) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ICON_COMMON}
    >
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}

function BookIcon(active: boolean) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ICON_COMMON}
    >
      <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 5v15a2 2 0 0 0 2 2h12" />
    </svg>
  )
}

function UserIcon(active: boolean) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ICON_COMMON}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

const TABS: Tab[] = [
  { href: '/learn',         labelRu: 'Главная', labelKz: 'Басты бет', icon: HomeIcon },
  { href: '/learn/study',   labelRu: 'Учёба',   labelKz: 'Оқу',       icon: BookIcon },
  { href: '/learn/profile', labelRu: 'Профиль', labelKz: 'Профиль',    icon: UserIcon },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/learn') return pathname === '/learn'
  return pathname.startsWith(href)
}

export function LearnNav({ language }: { language: Language }) {
  const pathname = usePathname() ?? '/learn'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cab-teal/10"
      style={{
        background: 'rgba(10,13,20,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}
    >
      <ul className="mx-auto flex max-w-[480px]">
        {TABS.map(tab => {
          const active = isActive(pathname, tab.href)
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-1 py-2.5 font-geologica text-[11px] transition ${
                  active ? 'text-cab-teal' : 'text-cab-muted hover:text-cab-text'
                }`}
              >
                <span
                  style={
                    active
                      ? { filter: 'drop-shadow(0 0 6px rgba(30,200,200,0.9))' }
                      : undefined
                  }
                >
                  {tab.icon(active)}
                </span>
                <span className={active ? 'font-semibold' : ''}>
                  {language === 'kz' ? tab.labelKz : tab.labelRu}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
