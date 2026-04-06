'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SubjectScore { name_ru: string; name_kz: string; score: number; total: number }

interface ResultData {
  score: number
  total_questions: number
  cert_type: 'winner' | 'prize' | 'participant'
  passed_to_round2: boolean
  completed_at: string
  language: 'ru' | 'kz'
  subject_scores: SubjectScore[] | null
  student: { full_name: string; grade: string | null } | null
  olympiad: { name_ru: string; name_kz: string; outro_video_url: string | null } | null
}

function toEmbedUrl(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1&autoplay=1` : null
}

// Falling stars animation with basket + counter
function FallingStars({ score, total, lang }: { score: number; total: number; lang: 'ru' | 'kz' }) {
  const [count, setCount] = useState(0)
  const FALL_SECS = 1.8
  const STAGGER_SECS = 0.25
  const audioCtxRef = useRef<AudioContext | null>(null)

  function getCtx(): AudioContext | null {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
      return audioCtxRef.current
    } catch { return null }
  }

  function playDing(index: number) {
    const ctx = getCtx(); if (!ctx) return
    const freq = 700 + (index / Math.max(score - 1, 1)) * 900
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, ctx.currentTime + 0.07)
    gain.gain.setValueAtTime(0.22, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.45)
  }

  function playFanfare() {
    const ctx = getCtx(); if (!ctx) return
    const notes = [523.25, 659.25, 783.99, 1046.50] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const d = i * 0.1
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + d)
      gain.gain.setValueAtTime(0, ctx.currentTime + d)
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + d + 0.04)
      gain.gain.setValueAtTime(0.2, ctx.currentTime + d + 0.3)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 2.0)
      osc.start(ctx.currentTime + d); osc.stop(ctx.currentTime + d + 2.0)
    })
  }

  useEffect(() => {
    if (score === 0) return
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < score; i++) {
      timers.push(setTimeout(() => {
        setCount(i + 1)
        if (i === score - 1) playFanfare()
        else playDing(i)
      }, (i * STAGGER_SECS + FALL_SECS * 0.88) * 1000))
    }
    return () => timers.forEach(clearTimeout)
  }, [score]) // eslint-disable-line

  const allLanded = count === score && score > 0

  // Distribute stars ±100px from center, stagger odd rows
  const COLS = 7
  const starPositions = Array.from({ length: score }, (_, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = ((col / (COLS - 1)) - 0.5) * 200
    const nudge = (row % 2) * (200 / COLS / 2)
    return Math.round(x + nudge)
  })

  return (
    <>
      <style>{`
        @keyframes starFallIn {
          0%   { transform: translateX(var(--sx)) translateY(0)     scale(1)   rotate(0deg);   opacity: 0; }
          8%   { opacity: 1; }
          82%  { transform: translateX(0)          translateY(220px) scale(0.5) rotate(360deg); opacity: 1; }
          100% { transform: translateX(0)          translateY(240px) scale(0)   rotate(400deg); opacity: 0; }
        }
        @keyframes countPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div style={{ width: '100%' }}>

        {/* Stars fall from top into the basket below — no overflow:hidden so they reach basket */}
        <div style={{ position: 'relative', height: 0 }}>
          {starPositions.map((sx, i) => (
            <span key={i} style={{
              '--sx': `${sx}px`,
              position: 'absolute',
              top: 0,
              left: '50%',
              marginLeft: '-12px',
              fontSize: 24,
              display: 'inline-block',
              zIndex: 4,
              animation: `starFallIn ${FALL_SECS}s ease-in ${i * STAGGER_SECS}s both`,
            } as React.CSSProperties}>⭐</span>
          ))}
        </div>

        {/* Basket in normal flow — always visible, brightens when full */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 0 }}>
          <img
            src="/basket-full.png"
            alt=""
            style={{
              width: 200,
              height: 200,
              objectFit: 'contain',
              mixBlendMode: 'screen',
              filter: allLanded
                ? 'brightness(1.1) contrast(1.8)'
                : 'brightness(0.22) contrast(1.6)',
              transition: 'filter 0.7s ease-out',
              display: 'block',
            }}
          />
        </div>

        {/* Counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 0 }}>
          <div key={count} style={{
            fontFamily: 'monospace', fontWeight: 900, fontSize: 68,
            color: '#FFD700', textShadow: '0 0 32px rgba(255,215,0,0.55)', lineHeight: 1,
            animation: 'countPop 0.3s ease-out',
          }}>
            {count}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#4a7070', lineHeight: 1.7, paddingTop: 8 }}>
            / {total}<br />
            {lang === 'kz' ? 'жұлдыз' : 'звёзд'}
          </div>
        </div>
      </div>
    </>
  )
}

export default function ResultPage() {
  const router = useRouter()
  const [result, setResult] = useState<ResultData | null>(null)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'video' | 'result'>('result')

  useEffect(() => {
    fetch('/api/quiz/result')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        if (r.status === 404) { router.push('/intro'); return null }
        return r.json()
      })
      .then(data => {
        if (data) {
          setResult(data)
          if (data.olympiad?.outro_video_url) setPhase('video')
        }
      })
      .catch(() => setError('Ошибка загрузки'))
  }, [router])

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#06100f' }}>
        <div className="font-mono text-sm text-[#1a3030]">{error || 'Загрузка...'}</div>
      </div>
    )
  }

  const lang = result.language
  const passed = result.passed_to_round2
  const outroEmbedUrl = toEmbedUrl(result.olympiad?.outro_video_url ?? null)

  const passedMsg = lang === 'kz'
    ? 'Сен — Zeyin Суперагентісің!\nСені 2-ші турда күтеміз!'
    : 'Ты — Суперагент Zeyin!\nЖдём тебя во втором туре!'

  const notPassedMsg = lang === 'kz'
    ? 'Бұл жолы Zeyin Суперагенті атағына сәл ғана жетпей қалдың…\nКелесі жолы міндетті түрде шығасың!'
    : 'В этот раз до звания Суперагента Zeyin совсем чуть-чуть не хватило…\nВ следующий раз обязательно получится!'

  // ── Phase: Outro video ──
  if (phase === 'video' && outroEmbedUrl) {
    return (
      <div className="phone-bg" style={{ background: 'radial-gradient(ellipse at top left, #061a1a 0%, #06100f 60%)' }}>
        <div className="phone-card relative mx-auto">
          <div className="absolute inset-x-0 top-0 z-10 h-[4px]"
            style={{ background: 'linear-gradient(90deg, #1ec8c8, #e8206e, #f47920, #e8206e, #1ec8c8)' }} />
          <div style={{ borderBottom: '1px solid #0f2422', padding: '12px 20px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, background: 'linear-gradient(90deg, #1ec8c8, #fff, #e8206e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {lang === 'kz' ? result.olympiad?.name_kz : result.olympiad?.name_ru}
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-8 pt-4">
            <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.25em', color: '#1ec8c8', textTransform: 'uppercase' }}>
              {lang === 'kz' ? 'Финалдық видео' : 'Финальное видео'}
            </div>
            <div className="w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '16/9', position: 'relative' }}>
              <iframe src={outroEmbedUrl} className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen />
              {/* Top overlay — blocks video title + info cards */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '18%', zIndex: 10 }} />
              {/* Right-side overlay — blocks watermark, channel button, end-screen cards */}
              <div style={{ position: 'absolute', top: '18%', right: 0, width: '18%', bottom: '18%', zIndex: 10 }} />
              {/* Bottom-right overlay — blocks settings, fullscreen, YouTube logo */}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '35%', height: '18%', zIndex: 10 }} />
            </div>
            <button onClick={() => setPhase('result')}
              className="w-full rounded-2xl py-4 text-base font-bold text-[#06100f]"
              style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)', boxShadow: '0 6px 20px rgba(30,200,200,0.27)' }}>
              {lang === 'kz' ? 'Нәтижені көру →' : 'Узнать результат →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Phase: Result ──
  return (
    <div className="phone-bg" style={{ background: 'radial-gradient(ellipse at top left, #061a1a 0%, #06100f 60%)' }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .msg-appear { animation: fadeInUp 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes starGrow {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        .star-grow { animation: starGrow 0.6s cubic-bezier(0.34,1.7,0.64,1) forwards; }
      `}</style>

      <div className="phone-card relative mx-auto">
        <div className="absolute inset-x-0 top-0 z-10 h-[4px]"
          style={{ background: 'linear-gradient(90deg, #1ec8c8, #e8206e, #f47920, #e8206e, #1ec8c8)' }} />

        <div style={{ borderBottom: '1px solid #0f2422', padding: '12px 20px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, background: 'linear-gradient(90deg, #1ec8c8, #fff, #e8206e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {lang === 'kz' ? result.olympiad?.name_kz : result.olympiad?.name_ru}
          </div>
        </div>

        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>

          {/* Falling stars animation */}
          <FallingStars score={result.score} total={result.total_questions} lang={lang} />

          {/* Passed: super-agent image + message. Not passed: message only */}
          {passed ? (
            <div className="msg-appear" style={{ textAlign: 'center', width: '100%' }}>
              <img
                src="/super-agent.PNG"
                alt="Super Agent"
                style={{ width: '100%', maxWidth: 300, height: 'auto', display: 'block', margin: '0 auto' }}
              />
              <div style={{
                marginTop: 16,
                fontWeight: 800,
                fontSize: 17,
                lineHeight: 1.5,
                color: '#e8206e',
                fontFamily: 'sans-serif',
                whiteSpace: 'pre-line',
                textTransform: 'uppercase',
              }}>
                {passedMsg}
              </div>
            </div>
          ) : (
            <div className="msg-appear" style={{
              textAlign: 'center', width: '100%',
              padding: '20px',
              borderRadius: 18,
              background: 'rgba(74,112,112,0.07)',
              border: '1px solid rgba(74,112,112,0.2)',
            }}>
              <div style={{
                fontWeight: 800,
                fontSize: 14,
                lineHeight: 1.6,
                color: '#4a7070',
                fontFamily: 'sans-serif',
                whiteSpace: 'pre-line',
                textTransform: 'uppercase',
              }}>
                {notPassedMsg}
              </div>
            </div>
          )}

          {/* Subject breakdown */}
          {(result.subject_scores ?? []).length > 0 && (
            <div style={{ width: '100%' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#1a3030', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                {lang === 'kz' ? 'Пәндер бойынша' : 'По предметам'}
              </div>
              {(result.subject_scores ?? []).map((s, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', background: '#0c1a19', borderRadius: 10, marginBottom: 6,
                  border: '1px solid #0f2422',
                }}>
                  <span style={{ color: '#b2e8e8', fontFamily: 'sans-serif', fontSize: 13 }}>
                    {lang === 'kz' ? s.name_kz : s.name_ru}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1ec8c8' }}>
                    ⭐ {s.score}/{s.total}
                  </span>
                </div>
              ))}
            </div>
          )}


        </div>
      </div>
    </div>
  )
}
