'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import OlympiadHeader from '@/components/OlympiadHeader'

function toEmbedUrl(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1&autoplay=1` : null
}

interface OlympiadInfo {
  id: string
  name_ru: string
  name_kz: string
  status: string
  start_time: string | null
  duration_minutes: number
  intro_text_ru: string | null
  intro_text_kz: string | null
  intro_video_url_ru: string | null
  intro_video_url_kz: string | null
}

const STATUS_LABELS: Record<string, { ru: string; kz: string }> = {
  draft: { ru: 'Олимпиада ещё не открыта', kz: 'Олимпиада әлі ашылмаған' },
  registration: { ru: 'Идёт регистрация. Ожидайте старта.', kz: 'Тіркеу жүріп жатыр. Старт күтіңіз.' },
  finished: { ru: 'Олимпиада завершена', kz: 'Олимпиада аяқталды' },
}

export default function IntroPage() {
  const router = useRouter()
  const [olympiad, setOlympiad] = useState<OlympiadInfo | null>(null)
  const [language, setLanguage] = useState<'ru' | 'kz'>('ru')
  const [, setHasSession] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    fetch('/api/quiz/session')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        if (r.status === 404) { setError('Олимпиада не найдена. Обратитесь к организатору.'); return null }
        if (!r.ok) { setError(`Ошибка сервера (${r.status})`); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        if (!data.olympiad) { setError('Олимпиада не настроена. Обратитесь к организатору.'); return }
        setOlympiad(data.olympiad)
        setLanguage(data.language ?? 'ru')
        if (data.session?.is_completed) {
          router.push('/result')
          return
        }
        if (data.session) {
          router.push('/quiz')
          return
        }
        setHasSession(false)
      })
      .catch(() => setError('Ошибка загрузки'))
  }, [router])

  // Countdown to start_time
  useEffect(() => {
    if (!olympiad?.start_time || olympiad.status === 'active') return
    const update = () => {
      const diff = new Date(olympiad.start_time!).getTime() - Date.now()
      if (diff <= 0) { setCountdown(''); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${h > 0 ? h + 'ч ' : ''}${m}м ${s}с`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [olympiad])

  async function handleStart() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/quiz/session', { method: 'POST' })
      if (res.ok) {
        router.push('/quiz')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Ошибка старта')
        setStarting(false)
      }
    } catch {
      setError('Ошибка сети')
      setStarting(false)
    }
  }

  const lang = language

  if (!olympiad) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#06100f' }}>
        <div className="font-mono text-sm text-[#1a3030]">
          {error || (lang === 'ru' ? 'Загрузка...' : 'Жүктелуде...')}
        </div>
      </div>
    )
  }

  const isActive = olympiad.status === 'active'
  const notActive = !isActive && olympiad.status !== 'finished'
  const introText = lang === 'kz' ? olympiad.intro_text_kz : olympiad.intro_text_ru
  const olympiadName = lang === 'kz' ? olympiad.name_kz : olympiad.name_ru
  const videoUrl = toEmbedUrl(lang === 'kz' ? olympiad.intro_video_url_kz : olympiad.intro_video_url_ru)

  const t = {
    start: lang === 'kz' ? 'Бастау' : 'Начать олимпиаду',
    starting: lang === 'kz' ? 'Жүктелуде...' : 'Загрузка...',
    duration: lang === 'kz' ? `Уақыт: ${olympiad.duration_minutes} минут` : `Время: ${olympiad.duration_minutes} минут`,
    rulesTitle: lang === 'kz' ? 'Ережелер' : 'Правила',
    waitTitle: lang === 'kz' ? 'Күту' : 'Ожидание',
    finishedMsg: lang === 'kz' ? 'Олимпиада аяқталды' : 'Олимпиада завершена',
  }

  const defaultRules = lang === 'kz'
    ? `• Барлық сұрақтарға жауап беріңіз\n• Артқа қайта аласыз\n• Браузерді жаппаңыз\n• Уақыт аяқталғанда автоматты түрде аяқталады`
    : `• Отвечайте на все вопросы\n• Можно возвращаться назад\n• Не закрывайте браузер\n• При истечении времени тест завершится автоматически`

  return (
    <div className="phone-bg"
      style={{ background: 'radial-gradient(ellipse at top left, #061a1a 0%, #06100f 60%)' }}>

      <div className="phone-card relative mx-auto">

        <div className="absolute left-1/2 top-0 z-10 h-7 w-[120px] -translate-x-1/2 rounded-b-[18px] bg-[#06100f]" />
        <div className="absolute inset-x-0 top-0 z-[5] h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #1ec8c8, #d4145a, #f47920, transparent)' }} />

        <OlympiadHeader title={lang === 'kz' ? olympiad.name_kz : olympiad.name_ru} />

        <div className="flex flex-1 flex-col px-5 pb-8 pt-4">
          {/* Olympiad name */}
          <div className="mb-4 rounded-2xl border border-[#0f2422] bg-[#0c1a19] p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-[#1ec8c8]">
              {lang === 'kz' ? 'Олимпиада' : 'Олимпиада'}
            </div>
            <div className="mt-1 text-base font-black text-[#b2e8e8]">{olympiadName}</div>
            <div className="mt-2 font-mono text-xs text-[#4a7070]">{t.duration}</div>
          </div>

          {/* Status: not active */}
          {notActive && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <div className="text-4xl">⏳</div>
              <div className="text-center text-sm font-bold text-[#b2e8e8]">
                {STATUS_LABELS[olympiad.status]?.[lang] ?? t.waitTitle}
              </div>
              {countdown && (
                <div className="rounded-2xl border border-[#0f2422] bg-[#0c1a19] px-6 py-3 font-mono text-2xl font-bold text-[#1ec8c8]">
                  {countdown}
                </div>
              )}
              <div className="text-center text-xs text-[#1a3030]">
                {lang === 'kz' ? 'Бет автоматты жаңартылмайды' : 'Страница не обновляется автоматически'}
              </div>
              <button onClick={() => window.location.reload()}
                className="rounded-xl border border-[#0f2422] px-4 py-2 text-xs text-[#4a7070] hover:text-[#1ec8c8]">
                {lang === 'kz' ? '↻ Жаңарту' : '↻ Обновить'}
              </button>
            </div>
          )}

          {/* Status: finished */}
          {olympiad.status === 'finished' && (
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="text-center text-sm text-[#4a7070]">{t.finishedMsg}</div>
            </div>
          )}

          {/* Status: active — show intro + start button */}
          {isActive && (
            <div className="flex flex-1 flex-col gap-4">
              {/* Intro video */}
              {videoUrl && (
                <div className="overflow-hidden rounded-2xl" style={{ aspectRatio: '16/9', position: 'relative' }}>
                  <iframe src={videoUrl} className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen />
                  {/* Top overlay — blocks video title + info cards */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '18%', zIndex: 10 }} />
                  {/* Right-side overlay — blocks watermark, channel button, end-screen cards */}
                  <div style={{ position: 'absolute', top: '18%', right: 0, width: '18%', bottom: '18%', zIndex: 10 }} />
                  {/* Bottom-right overlay — blocks settings, fullscreen, YouTube logo */}
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '35%', height: '18%', zIndex: 10 }} />
                </div>
              )}

              {/* Rules */}
              <div className="rounded-2xl border border-[#0f2422] bg-[#0c1a19] p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[#f47920]">
                  {t.rulesTitle}
                </div>
                <div className="whitespace-pre-line text-sm leading-relaxed text-[#4a7070]">
                  {introText || defaultRules}
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-auto">
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="w-full rounded-2xl py-4 text-base font-bold text-[#06100f] transition-all disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)',
                    boxShadow: '0 6px 20px rgba(30,200,200,0.27)',
                  }}>
                  {starting ? t.starting : t.start}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
