'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import OlympiadHeader from '@/components/OlympiadHeader'

interface Question {
  id: string
  type: 'test' | 'video' | 'task'
  question_ru: string
  question_kz: string
  option_a_ru: string; option_b_ru: string; option_c_ru: string; option_d_ru: string
  option_a_kz: string; option_b_kz: string; option_c_kz: string; option_d_kz: string
  youtube_url_ru: string | null
  youtube_url_kz: string | null
  order_num: number
}

interface QuizSession { id: string; started_at: string; is_completed: boolean }
interface OlympiadMeta { duration_minutes: number; name_ru: string; name_kz: string }
type Answers = Record<string, string>

// A → teal, B → pink2, C → orange, D → teal2
const OPTION_COLORS = { a: '#1ec8c8', b: '#e8206e', c: '#f47920', d: '#0fa8a8' }
const OPTIONS = ['a', 'b', 'c', 'd'] as const

function toEmbedUrl(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1&disablekb=1&fs=0&playsinline=1&iv_load_policy=3&autoplay=1` : null
}

export default function QuizPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const [current, setCurrent] = useState(0)
  const [session, setSession] = useState<QuizSession | null>(null)
  const [olympiad, setOlympiad] = useState<OlympiadMeta | null>(null)
  const [language, setLanguage] = useState<'ru' | 'kz'>('ru')
  const [timeLeft, setTimeLeft] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [loading, setLoading] = useState(true)
  const savingRef = useRef<Set<string>>(new Set())
  const finishedRef = useRef(false)

  useEffect(() => {
    fetch('/api/quiz/session')
      .then(r => { if (r.status === 401) { router.push('/login'); return null } return r.json() })
      .then(data => {
        if (!data) return
        if (!data.session) { router.push('/intro'); return }
        if (data.session.is_completed) { router.push('/result'); return }
        setSession(data.session)
        setOlympiad(data.olympiad)
        setLanguage(data.language ?? 'ru')
        setQuestions(data.questions ?? [])
        const answerMap: Answers = {}
        for (const a of data.answers ?? []) answerMap[a.question_id] = a.selected_option
        setAnswers(answerMap)
        const elapsed = Math.floor((Date.now() - new Date(data.session.started_at).getTime()) / 1000)
        setTimeLeft(Math.max(0, (data.olympiad?.duration_minutes ?? 60) * 60 - elapsed))
        setLoading(false)
      })
      .catch(() => router.push('/intro'))
  }, [router])

  useEffect(() => {
    if (loading || !session) return
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); if (!finishedRef.current) finishQuiz(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [loading, session]) // eslint-disable-line

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  const saveAnswer = useCallback(async (questionId: string, option: string) => {
    if (savingRef.current.has(questionId)) return
    savingRef.current.add(questionId)
    try {
      await fetch('/api/quiz/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId, selected_option: option }),
      })
    } finally { savingRef.current.delete(questionId) }
  }, [])

  function selectAnswer(option: string) {
    const q = questions[current]; if (!q) return
    if (answers[q.id] === option) return // already saved, skip
    setAnswers(prev => ({ ...prev, [q.id]: option }))
    saveAnswer(q.id, option)
  }

  async function finishQuiz() {
    if (finishedRef.current) return
    finishedRef.current = true; setFinishing(true)
    try { await fetch('/api/quiz/finish', { method: 'POST' }); router.push('/result') }
    catch { finishedRef.current = false; setFinishing(false) }
  }

  function confirmFinish() {
    const unanswered = questions.filter(q => !answers[q.id]).length
    const msg = language === 'kz'
      ? `${unanswered > 0 ? `${unanswered} сұраққа жауап берілмеді. ` : ''}Аяқтауға сенімдісіз бе?`
      : `${unanswered > 0 ? `${unanswered} вопросов без ответа. ` : ''}Завершить олимпиаду?`
    if (confirm(msg)) finishQuiz()
  }

  function fmtTime(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#06100f' }}>
        <div className="font-mono text-sm text-[#1a3030]">
          {language === 'kz' ? 'Жүктелуде...' : 'Загрузка...'}
        </div>
      </div>
    )
  }

  const q = questions[current]
  if (!q) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#06100f' }}>
      <div className="text-sm text-[#4a7070]">{language === 'kz' ? 'Сұрақтар жоқ' : 'Нет вопросов'}</div>
    </div>
  )

  const lang = language
  const questionText = lang === 'kz' ? q.question_kz : q.question_ru
  const videoUrl = toEmbedUrl(lang === 'kz' ? q.youtube_url_kz : q.youtube_url_ru)
  const answered = answers[q.id]
  const answeredCount = questions.filter(x => answers[x.id]).length
  const isLowTime = timeLeft < 120
  const optionLabel = (opt: typeof OPTIONS[number]) => q[`option_${opt}_${lang}` as keyof Question] as string

  const TYPE_LABEL = {
    video: lang === 'kz' ? '▶ БЕЙНЕ' : '▶ ВИДЕО',
    task:  lang === 'kz' ? '✎ ТАПСЫРМА' : '✎ ЗАДАЧА',
    test:  lang === 'kz' ? '✓ ТЕСТ' : '✓ ТЕСТ',
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#06100f' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20" style={{ background: '#06100f' }}>
        <div className="mx-auto w-full max-w-[430px]">
        <OlympiadHeader title={lang === 'kz' ? olympiad?.name_kz : olympiad?.name_ru} />

        {/* Stats bar */}
        <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid #0f2422' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>

            {/* Timer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: isLowTime ? 'rgba(239,68,68,0.1)' : 'transparent',
              borderRadius: 20, padding: '5px 12px',
              border: isLowTime ? '1px solid rgba(239,68,68,0.25)' : '1px solid #0f2422',
            }}>
              <span style={{ color: isLowTime ? '#ef4444' : '#1ec8c8', fontSize: 10 }}>⏱</span>
              <span style={{
                color: isLowTime ? '#f87171' : '#1ec8c8',
                fontWeight: 'bold', fontFamily: 'monospace', fontSize: 15,
              }}>{fmtTime(timeLeft)}</span>
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 180, justifyContent: 'center' }}>
              {questions.map((x, i) => {
                const isCurrent = i === current
                const isDone = !!answers[x.id]
                return (
                  <div key={x.id} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: isCurrent ? '#f47920' : isDone ? '#1ec8c8' : '#0f2422',
                    boxShadow: isCurrent
                      ? '0 0 6px #f4792099'
                      : isDone ? '0 0 5px #1ec8c888' : 'none',
                    transition: 'all 0.2s',
                  }} />
                )
              })}
            </div>

            {/* Count */}
            <div style={{ color: '#1ec8c8', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' }}>
              {answeredCount}/{questions.length}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: '#0f2422', borderRadius: 99, height: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #1ec8c8, #e8206e)',
              borderRadius: 99, transition: 'width 0.4s',
            }} />
          </div>

          {/* Q number + type */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, fontFamily: 'monospace' }}>
            <span style={{ color: '#1a3030' }}>Q{current + 1} / {questions.length}</span>
            <span style={{ color: q.type === 'video' ? '#f47920' : q.type === 'task' ? '#e8206e' : '#1ec8c8' }}>
              {TYPE_LABEL[q.type]}
            </span>
          </div>
        </div>
        </div> {/* end max-w wrapper */}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div className="mx-auto w-full max-w-[430px]" style={{ padding: '16px 20px' }}>

        {/* Video embed */}
        {q.type === 'video' && videoUrl && (
          <div style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 16, aspectRatio: '16/9', position: 'relative' }}>
            <iframe src={videoUrl} style={{ width: '100%', height: '100%', display: 'block' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
            {/* Top overlay — blocks YouTube logo and top controls */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, zIndex: 2, background: 'transparent', pointerEvents: 'auto' }} />
            {/* Bottom overlay — blocks bottom control bar buttons */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, zIndex: 2, background: 'transparent', pointerEvents: 'auto' }} />
          </div>
        )}
        {q.type === 'video' && !videoUrl && (
          <div style={{
            borderRadius: 18, marginBottom: 16, aspectRatio: '16/9',
            background: '#050e0e', border: '1px solid #0f2422',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#1a3030', fontSize: 13, fontFamily: 'monospace' }}>
              {lang === 'kz' ? 'Видео жоқ' : 'Видео недоступно'}
            </span>
          </div>
        )}

        {/* Question card — teal left border */}
        <div style={{
          background: '#0c1a19', borderRadius: 16, padding: '16px',
          marginBottom: 14, border: '1px solid #0f2422',
          borderLeft: '3px solid #1ec8c8',
        }}>
          <p style={{ color: '#b2e8e8', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
            {questionText}
          </p>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 12 }}>
          {OPTIONS.map(opt => {
            const ac = OPTION_COLORS[opt]
            const isSelected = answered === opt
            const label = optionLabel(opt)
            return (
              <button key={opt} onClick={() => selectAnswer(opt)} style={{
                background: isSelected ? `${ac}15` : '#0c1a19',
                border: `1.5px solid ${isSelected ? ac : '#0f2422'}`,
                borderRadius: 13, padding: '13px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                boxShadow: isSelected ? `0 0 20px ${ac}20` : 'none',
              }}>
                {/* Letter badge */}
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: isSelected ? ac : '#0a1a1a',
                  border: isSelected ? 'none' : `1.5px solid ${ac}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: isSelected ? '#06100f' : ac,
                  fontWeight: 'bold', fontFamily: 'monospace',
                }}>
                  {isSelected ? '✓' : opt.toUpperCase()}
                </div>
                {/* Text */}
                <span style={{
                  color: isSelected ? '#e0ffff' : '#4a7070',
                  fontSize: 14, fontWeight: isSelected ? 600 : 400,
                }}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      </div> {/* end content scroll */}

      {/* ── Bottom nav ── */}
      <div style={{ background: '#06100f', borderTop: '1px solid #0f2422' }}>
      <div className="mx-auto w-full max-w-[430px]" style={{ padding: '10px 20px 32px', display: 'flex', gap: 10 }}>
        <button onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0} style={{
          flex: 1, padding: '14px', background: '#0c1a19',
          border: '1px solid #0f2422', borderRadius: 13,
          color: current === 0 ? '#1a3030' : '#4a7070',
          fontSize: 14, cursor: current === 0 ? 'not-allowed' : 'pointer',
        }}>← {lang === 'kz' ? 'Артқа' : 'Назад'}</button>

        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(p => Math.min(questions.length - 1, p + 1))} style={{
            flex: 2, padding: '14px',
            background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)',
            border: 'none', borderRadius: 13, color: '#06100f',
            fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(30,200,200,0.27)',
          }}>
            {lang === 'kz' ? 'Келесі →' : 'Далее →'}
          </button>
        ) : (
          <button onClick={confirmFinish} disabled={finishing} style={{
            flex: 2, padding: '14px',
            background: finishing ? '#0c1a19' : 'linear-gradient(135deg, #d4145a, #e8206e)',
            border: 'none', borderRadius: 13, color: finishing ? '#4a7070' : '#fff',
            fontSize: 14, fontWeight: 'bold', cursor: finishing ? 'not-allowed' : 'pointer',
          }}>
            {finishing ? '...' : (lang === 'kz' ? 'Аяқтау ✓' : 'Завершить ✓')}
          </button>
        )}
      </div>
      </div> {/* end bottom nav */}
    </div>
  )
}
