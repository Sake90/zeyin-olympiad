import { redirect } from 'next/navigation'
import { Unbounded, Geologica } from 'next/font/google'
import { getStudentSession } from '@/lib/auth'
import { createServiceClient, type Language } from '@/lib/supabase'
import { LearnNav } from '../_components/LearnNav'

export const dynamic = 'force-dynamic'

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700', '900'],
  variable: '--font-unbounded',
  display: 'swap',
})

const geologica = Geologica({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-geologica',
  display: 'swap',
})

function getInitial(name: string | null | undefined): string {
  if (!name) return '?'
  const first = name.trim().split(/\s+/)[0] ?? ''
  return first.charAt(0).toUpperCase() || '?'
}

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const session = await getStudentSession()
  if (!session) redirect('/learn/login')

  const db = createServiceClient()
  const { data: student } = await db
    .from('students')
    .select('id, full_name, language')
    .eq('id', session.studentId)
    .maybeSingle()

  const language: Language = (student as any)?.language ?? session.language ?? 'ru'
  const initial = getInitial((student as any)?.full_name)

  return (
    <div
      className={`${unbounded.variable} ${geologica.variable} cabinet-root relative min-h-screen bg-cab-bg font-geologica text-cab-text`}
    >
      {/* Ambient background gradients */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 600px 400px at 0% 0%, rgba(30,200,200,0.05) 0%, transparent 60%)',
            'radial-gradient(ellipse 500px 300px at 100% 100%, rgba(212,20,90,0.04) 0%, transparent 60%)',
          ].join(', '),
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[480px]">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-5"
          style={{ paddingTop: 'max(52px, calc(env(safe-area-inset-top) + 20px))', paddingBottom: 16 }}
        >
          <span className="select-none font-unbounded text-[18px] font-black leading-none tracking-tight">
            <span className="text-cab-teal">ZEY</span>
            <span className="text-cab-magenta">IN</span>
          </span>
          <div
            className="grid h-[38px] w-[38px] place-items-center rounded-full font-unbounded text-[14px] font-bold text-[#0a0d14]"
            style={{
              background: 'linear-gradient(135deg, #1ec8c8, #0fa8a8)',
              boxShadow: '0 0 16px rgba(30,200,200,0.25)',
            }}
          >
            {initial}
          </div>
        </header>

        <main
          key="cabinet-main"
          className="animate-cab-fade-up px-5 pb-[120px]"
        >
          {children}
        </main>
      </div>

      <LearnNav language={language} />
    </div>
  )
}
