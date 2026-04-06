'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ZeyinLogo from '@/components/ZeyinLogo'

interface SubjectScore { name_ru: string; name_kz: string; score: number; total: number }

interface CertData {
  score: number
  total_questions: number
  cert_type: 'winner' | 'prize' | 'participant'
  passed_to_round2: boolean
  completed_at: string
  language: 'ru' | 'kz'
  subject_scores: SubjectScore[] | null
  student: { full_name: string; grade: string | null; school: string | null } | null
  olympiad: { name_ru: string; name_kz: string } | null
}

const CERT_CONFIG = {
  winner: {
    ru: 'ПОБЕДИТЕЛЬ',
    kz: 'ЖЕҢІМПАЗЫ',
    subRu: 'Диплом I степени',
    subKz: 'I дәрежелі диплом',
    color1: '#f47920',
    color2: '#d4145a',
    emoji: '🥇',
  },
  prize: {
    ru: 'ПРИЗЁР',
    kz: 'ЖҮЛДЕГЕРІ',
    subRu: 'Диплом II степени',
    subKz: 'II дәрежелі диплом',
    color1: '#1ec8c8',
    color2: '#0fa8a8',
    emoji: '🥈',
  },
  participant: {
    ru: 'УЧАСТНИК',
    kz: 'ҚАТЫСУШЫСЫ',
    subRu: 'Сертификат участника',
    subKz: 'Қатысушы куәлігі',
    color1: '#6b7280',
    color2: '#4b5563',
    emoji: '🎓',
  },
}

const CORNER_COLORS = ['#1ec8c8', '#e8206e', '#f47920', '#0fa8a8']

export default function CertificatePage() {
  const router = useRouter()
  const [data, setData] = useState<CertData | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/quiz/result')
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null }
        if (r.status === 404) { router.push('/intro'); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(() => setError('Ошибка загрузки'))
  }, [router])

  function handlePrint() {
    window.print()
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#06100f' }}>
        <div className="font-mono text-sm text-[#1a3030]">{error || 'Загрузка...'}</div>
      </div>
    )
  }

  const lang = data.language
  const cert = CERT_CONFIG[data.cert_type]
  const olympiadName = lang === 'kz' ? data.olympiad?.name_kz : data.olympiad?.name_ru
  const year = new Date(data.completed_at).getFullYear()
  const dateStr = new Date(data.completed_at).toLocaleDateString(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ background: '#06100f', minHeight: '100svh' }} className="flex flex-col items-center md:p-4">

      {/* Back button */}
      <div className="mb-4 flex w-full max-w-[430px] items-center justify-between p-4 md:p-0 print:hidden">
        <button onClick={() => router.push('/result')}
          className="rounded-xl border border-[#0f2422] px-3 py-2 text-sm text-[#4a7070] hover:text-[#1ec8c8]">
          ← {lang === 'kz' ? 'Нәтижеге оралу' : 'Вернуться к результату'}
        </button>
        <div className="flex gap-2">
          <button onClick={handlePrint}
            className="rounded-xl border border-[#0f2422] px-3 py-2 text-sm text-[#4a7070] hover:text-[#1ec8c8]">
            🖨 {lang === 'kz' ? 'Басып шығару' : 'Распечатать'}
          </button>
        </div>
      </div>

      {/* Certificate */}
      <div
        className="w-full max-w-[430px] rounded-3xl md:max-w-2xl"
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #06100f 0%, #0c1a19 50%, #06100f 100%)',
          border: `2px solid ${cert.color1}40`,
          boxShadow: `0 0 60px ${cert.color1}20, 0 0 120px ${cert.color1}08`,
          display: 'flex',
          flexDirection: 'column',
        }}>

        {/* Corner dots */}
        <div style={{ position: 'absolute', top: 14, left: 14, width: 8, height: 8, borderRadius: '50%', background: CORNER_COLORS[0], boxShadow: `0 0 8px ${CORNER_COLORS[0]}` }} />
        <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: CORNER_COLORS[1], boxShadow: `0 0 8px ${CORNER_COLORS[1]}` }} />
        <div style={{ position: 'absolute', bottom: 14, left: 14, width: 8, height: 8, borderRadius: '50%', background: CORNER_COLORS[2], boxShadow: `0 0 8px ${CORNER_COLORS[2]}` }} />
        <div style={{ position: 'absolute', bottom: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: CORNER_COLORS[3], boxShadow: `0 0 8px ${CORNER_COLORS[3]}` }} />

        {/* Top rainbow line */}
        <div className="h-1 w-full"
          style={{ background: 'linear-gradient(90deg, #1ec8c8, #e8206e, #f47920, #e8206e, #1ec8c8)' }} />

        <div className="flex flex-1 flex-col items-center justify-between p-8 text-center">

          {/* Header */}
          <div className="flex flex-col items-center gap-3">
            {/* Logo ring */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full p-0.5"
              style={{ background: `conic-gradient(${cert.color1} 0deg, #d4145a 180deg, ${cert.color2} 300deg, ${cert.color1} 360deg)` }}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0a1f1e]">
                <ZeyinLogo size={34} />
              </div>
            </div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#4a7070]">
              ZEYIN OQU ORTALYGY
            </div>
          </div>

          {/* Main content */}
          <div className="flex flex-col items-center gap-4">
            {/* Cert type label */}
            <div className="font-mono text-sm uppercase tracking-widest" style={{ color: cert.color1 }}>
              {lang === 'kz' ? 'КУӘЛІК' : 'СЕРТИФИКАТ'}
            </div>

            {/* Cert level badge */}
            <div style={{
              border: `1.5px solid ${cert.color1}50`,
              borderRadius: 12,
              padding: '8px 20px',
              background: `${cert.color1}0d`,
            }}>
              <div className="font-mono text-sm uppercase tracking-widest" style={{ color: cert.color1 }}>
                {cert.emoji} {cert[lang === 'kz' ? 'kz' : 'ru']}
              </div>
              <div className="mt-0.5 font-mono text-xs text-[#4a7070]">
                {lang === 'kz' ? cert.subKz : cert.subRu}
              </div>
            </div>

            {/* Student name */}
            <div className="flex flex-col items-center gap-1">
              <div className="font-mono text-xs uppercase tracking-widest text-[#1a3030]">
                {lang === 'kz' ? 'берілді' : 'выдан'}
              </div>
              <div className="text-2xl font-black text-[#b2e8e8]">
                {data.student?.full_name ?? ''}
              </div>
              {data.student?.grade && (
                <div className="font-mono text-xs text-[#4a7070]">{data.student.grade}</div>
              )}
            </div>

            {/* Olympiad name */}
            {olympiadName && (
              <div className="max-w-xs text-sm text-[#4a7070]">
                {lang === 'kz' ? 'қатысқаны үшін' : 'за участие в'}{' '}
                <span className="font-bold text-[#b2e8e8]">«{olympiadName}»</span>
              </div>
            )}

            {/* Stars score */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-[#0f2422] bg-[#0c1a19] px-4 py-2.5">
              <span className="font-mono text-sm font-bold" style={{ color: cert.color1 }}>
                ⭐ {data.score} из {data.total_questions} {lang === 'kz' ? 'жұлдызша' : 'звёзд'}
              </span>
              {(data.subject_scores ?? []).length > 0 && (
                <div className="mt-1 flex flex-col gap-1">
                  {(data.subject_scores ?? []).map((s, i) => (
                    <div key={i} className="flex items-center justify-between font-mono text-xs">
                      <span style={{ color: '#4a7070' }}>{lang === 'kz' ? s.name_kz : s.name_ru}</span>
                      <span style={{ color: cert.color1 }}>⭐ {s.score}/{s.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Discount block */}
          <div style={{
            width: '100%',
            background: 'linear-gradient(135deg, #1a1200 0%, #2a1e00 100%)',
            border: '1.5px solid #FFD700',
            borderRadius: 14,
            padding: '12px 16px',
            boxShadow: '0 0 18px rgba(255,215,0,0.18)',
          }}>
            <p style={{
              color: '#FFD700',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.55,
              fontFamily: 'sans-serif',
              margin: 0,
            }}>
              {lang === 'kz'
                ? '🎁 Сыйлық! Олимпиада қатысушысы ретінде сізге ZEYIN oqu ortalygy-да 2026–2027 оқу жылына 10% жеңілдік берілді!'
                : '🎁 Подарок! Как участнику олимпиады, вам предоставляется скидка 10% на обучение в ZEYIN oqu ortalygy на 2026–2027 учебный год!'}
            </p>
          </div>

          {/* Footer */}
          <div className="flex w-full items-end justify-between">
            <div className="text-left">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#1a3030]">
                {lang === 'kz' ? 'Күні' : 'Дата'}
              </div>
              <div className="font-mono text-xs text-[#4a7070]">{dateStr}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl">{cert.emoji}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#1a3030]">
                ZEYIN • {year}
              </div>
              <div className="font-mono text-xs text-[#4a7070]">
                zeyin-olimpyad
              </div>
            </div>
          </div>
        </div>

        {/* Bottom rainbow line */}
        <div className="h-1 w-full"
          style={{ background: 'linear-gradient(90deg, #1ec8c8, #e8206e, #f47920, #e8206e, #1ec8c8)' }} />
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white; }
          @page { margin: 0; size: A4 landscape; }
        }
      `}</style>
    </div>
  )
}
