'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import BunnyPlayer from '@/components/BunnyPlayer'
import type { Explanation, ExplanationStyle, Language, Topic } from '@/lib/supabase'
import { ProgressRing } from '../../../_components/ProgressRing'

export type ClientQuestion = {
  id: string
  question_ru: string
  question_kz: string
  option_a_ru: string
  option_b_ru: string
  option_c_ru: string
  option_d_ru: string
  option_a_kz: string
  option_b_kz: string
  option_c_kz: string
  option_d_kz: string
  order_num: number
}

type Option = 'A' | 'B' | 'C' | 'D'
const OPTIONS: Option[] = ['A', 'B', 'C', 'D']

type Phase = 'learn' | 'test' | 'result'

type SubmitResponse = {
  score: number
  correctCount: number
  total: number
  passed: boolean
  threshold: number
  nextTopicId: string | null
  results: { questionId: string; selected: Option; correct?: Option; isCorrect: boolean }[]
  xpAwarded: number
}

const tr = {
  ru: {
    readyForTest: 'Я готов к тесту',
    next: 'Дальше',
    finish: 'Завершить',
    tryAnotherStyle: 'Попробуй другой подход',
    viewOther: 'Посмотреть другое объяснение',
    passedTitle: '🎉 Тема пройдена!',
    passedSub: 'Отличная работа',
    nextTopic: 'Следующая тема',
    backToTopics: 'Вернуться к темам',
    notPassed: 'Не переживай — можно попробовать ещё раз',
    retry: 'Повторить тест',
    noQuestions: 'В этой теме пока нет вопросов.',
    noExplanation: 'Объяснение ещё не добавлено.',
    questionOf: 'Вопрос',
    of: 'из',
    loading: 'Загрузка…',
    yourScore: 'Твой результат',
    xpAwarded: '+{n} XP',
  },
  kz: {
    readyForTest: 'Тестке дайынмын',
    next: 'Келесі',
    finish: 'Аяқтау',
    tryAnotherStyle: 'Басқа тәсілді қара',
    viewOther: 'Басқа түсіндіруді көру',
    passedTitle: '🎉 Тақырып аяқталды!',
    passedSub: 'Керемет!',
    nextTopic: 'Келесі тақырып',
    backToTopics: 'Тақырыптарға оралу',
    notPassed: 'Уайымдама — қайта көріп шығуға болады',
    retry: 'Тестті қайталау',
    noQuestions: 'Бұл тақырыпта әлі сұрақ жоқ.',
    noExplanation: 'Түсіндіру әлі қосылмаған.',
    questionOf: 'Сұрақ',
    of: ' / ',
    loading: 'Жүктелуде…',
    yourScore: 'Нәтижең',
    xpAwarded: '+{n} XP',
  },
} as const

export function TopicClient({
  topic,
  explanations,
  styles,
  questions,
  language,
}: {
  topic: Topic
  explanations: Explanation[]
  styles: ExplanationStyle[]
  questions: ClientQuestion[]
  language: Language
}) {
  const router = useRouter()
  const t = tr[language]

  const availableStyles = useMemo(
    () => styles.filter(s => explanations.some(e => e.style_code === s.code)),
    [styles, explanations]
  )

  const [phase, setPhase] = useState<Phase>('learn')
  const [styleIdx, setStyleIdx] = useState(0)
  const currentStyle = availableStyles[styleIdx]
  const explanation = useMemo(
    () => explanations.find(e => e.style_code === currentStyle?.code),
    [explanations, currentStyle]
  )

  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Option>>({})
  const [pickedThisQ, setPickedThisQ] = useState<Option | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResponse | null>(null)

  const title = language === 'kz' ? topic.title_kz : topic.title_ru

  function goToTest() {
    setPhase('test')
    setQIdx(0)
    setAnswers({})
    setPickedThisQ(null)
  }

  function pickOption(option: Option) {
    if (pickedThisQ) return
    setPickedThisQ(option)
  }

  async function commitAndNext() {
    if (!pickedThisQ) return
    const q = questions[qIdx]
    const nextAnswers = { ...answers, [q.id]: pickedThisQ }
    setAnswers(nextAnswers)
    setPickedThisQ(null)

    if (qIdx + 1 < questions.length) {
      setQIdx(qIdx + 1)
    } else {
      await submit(nextAnswers)
    }
  }

  async function submit(finalAnswers: Record<string, Option>) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/learn/submit-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          styleCode: currentStyle?.code ?? null,
          answers: Object.entries(finalAnswers).map(([questionId, selected]) => ({
            questionId,
            selected,
          })),
        }),
      })
      if (!res.ok) throw new Error('submit failed')
      const data: SubmitResponse = await res.json()
      setResult(data)
      setPhase('result')
    } catch {
      setSubmitting(false)
    } finally {
      setSubmitting(false)
    }
  }

  function tryOtherStyle() {
    const nextIdx = styleIdx + 1 < availableStyles.length ? styleIdx + 1 : 0
    setStyleIdx(nextIdx)
    setPhase('learn')
    setResult(null)
    setAnswers({})
    setQIdx(0)
    setPickedThisQ(null)
  }

  function retry() {
    setPhase('learn')
    setResult(null)
    setAnswers({})
    setQIdx(0)
    setPickedThisQ(null)
  }

  // ─── Render phases ──────────────────────────────────────────────────────────

  if (phase === 'learn') {
    return (
      <div className="space-y-5">
        <Breadcrumb title={title} />

        {availableStyles.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {availableStyles.map((s, i) => {
              const active = i === styleIdx
              return (
                <button
                  key={s.code}
                  onClick={() => setStyleIdx(i)}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-geologica text-[13px] transition ${
                    active
                      ? 'cab-pill-active font-semibold'
                      : 'border border-white/10 text-cab-muted hover:text-cab-text'
                  }`}
                >
                  {s.icon && <span className="mr-1">{s.icon}</span>}
                  {language === 'kz' ? s.name_kz : s.name_ru}
                </button>
              )
            })}
          </div>
        )}

        {explanation ? (
          <article className="space-y-4">
            {(language === 'kz' ? explanation.title_kz : explanation.title_ru) && (
              <h2 className="font-unbounded text-[18px] font-bold text-cab-text">
                {language === 'kz' ? explanation.title_kz : explanation.title_ru}
              </h2>
            )}
            {explanation.video_id && (
              <div className="overflow-hidden rounded-[16px] border border-cab-teal/10">
                <BunnyPlayer videoId={explanation.video_id} title={title} />
              </div>
            )}
            {explanation.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={explanation.image_url}
                alt={title}
                className="w-full rounded-[16px] border border-cab-teal/10"
              />
            )}
            {(language === 'kz' ? explanation.content_kz : explanation.content_ru) && (
              <div className="cab-prose">
                <ReactMarkdown>
                  {(language === 'kz' ? explanation.content_kz : explanation.content_ru) ?? ''}
                </ReactMarkdown>
              </div>
            )}
          </article>
        ) : (
          <div className="cab-card text-center font-geologica text-[13px] text-cab-muted">
            {t.noExplanation}
          </div>
        )}

        {questions.length > 0 ? (
          <button
            onClick={goToTest}
            className="cab-btn-primary w-full px-6 py-4 font-unbounded text-[15px]"
          >
            {t.readyForTest} →
          </button>
        ) : (
          <div className="cab-card text-center font-geologica text-[13px] text-cab-muted">
            {t.noQuestions}
          </div>
        )}
      </div>
    )
  }

  if (phase === 'test') {
    const q = questions[qIdx]
    if (!q) return null
    const questionText = language === 'kz' ? q.question_kz : q.question_ru
    const optionTexts: Record<Option, string> = {
      A: (language === 'kz' ? q.option_a_kz : q.option_a_ru) ?? '',
      B: (language === 'kz' ? q.option_b_kz : q.option_b_ru) ?? '',
      C: (language === 'kz' ? q.option_c_kz : q.option_c_ru) ?? '',
      D: (language === 'kz' ? q.option_d_kz : q.option_d_ru) ?? '',
    }

    return (
      <div className="space-y-5">
        <Breadcrumb title={title} />
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 font-geologica text-[12px] text-cab-muted">
            {t.questionOf} {qIdx + 1} {t.of} {questions.length}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(qIdx / questions.length) * 100}%`,
                background: 'linear-gradient(90deg, var(--teal), #5eeaea)',
                boxShadow: '0 0 8px rgba(30,200,200,0.4)',
                transition: 'width 400ms ease-out',
              }}
            />
          </div>
        </div>

        <h2 className="font-unbounded text-[17px] font-semibold leading-snug text-cab-text">
          {questionText}
        </h2>

        <div className="space-y-2.5">
          {OPTIONS.map(opt => {
            const isPicked = pickedThisQ === opt
            const disabled = !!pickedThisQ
            return (
              <button
                key={opt}
                disabled={disabled}
                onClick={() => pickOption(opt)}
                className={`flex w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition ${
                  isPicked
                    ? 'border-cab-teal bg-cab-teal/15 text-cab-text'
                    : disabled
                      ? 'border-white/5 bg-cab-card/60 text-cab-muted'
                      : 'border-cab-teal/10 bg-cab-card text-cab-text hover:border-cab-teal/40 hover:bg-cab-teal/5'
                }`}
              >
                <span
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full font-unbounded text-[13px] font-bold ${
                    isPicked
                      ? 'text-[#0a0d14]'
                      : 'text-cab-muted'
                  }`}
                  style={
                    isPicked
                      ? { background: 'var(--teal)' }
                      : { border: '1px solid rgba(255,255,255,0.15)' }
                  }
                >
                  {opt}
                </span>
                <span className="flex-1 font-geologica text-[14px]">{optionTexts[opt]}</span>
              </button>
            )
          })}
        </div>

        <button
          onClick={commitAndNext}
          disabled={!pickedThisQ || submitting}
          className="cab-btn-primary w-full px-6 py-4 font-unbounded text-[15px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? t.loading : qIdx + 1 === questions.length ? t.finish : t.next} →
        </button>
      </div>
    )
  }

  if (phase === 'result' && result) {
    const hasOtherStyle = availableStyles.length > 1
    return (
      <div className="space-y-6">
        <Breadcrumb title={title} />

        <div className="cab-card flex flex-col items-center gap-3 text-center">
          <ProgressRing
            percent={result.score}
            size={160}
            stroke={12}
            label={
              <div>
                <div className="font-unbounded text-[36px] font-black leading-none text-cab-text">
                  {result.score}
                  <span className="text-[18px] font-bold text-cab-muted">%</span>
                </div>
                <div className="mt-1 font-geologica text-[12px] text-cab-muted">
                  {result.correctCount} / {result.total}
                </div>
              </div>
            }
          />
          <div className="mt-2 font-unbounded text-[18px] font-bold text-cab-text">
            {result.passed ? t.passedTitle : t.yourScore}
          </div>
          {result.passed && result.xpAwarded > 0 && (
            <div className="font-geologica text-[13px] font-semibold text-cab-teal">
              {t.xpAwarded.replace('{n}', String(result.xpAwarded))}
            </div>
          )}
          {!result.passed && (
            <div className="font-geologica text-[13px] text-cab-muted">{t.notPassed}</div>
          )}
        </div>

        <div className="space-y-2.5">
          {result.passed ? (
            result.nextTopicId ? (
              <button
                onClick={() => router.push(`/learn/topic/${result.nextTopicId}`)}
                className="cab-btn-primary w-full px-6 py-4 font-unbounded text-[15px]"
              >
                {t.nextTopic} →
              </button>
            ) : (
              <button
                onClick={() => router.push('/learn/study')}
                className="cab-btn-primary w-full px-6 py-4 font-unbounded text-[15px]"
              >
                {t.backToTopics}
              </button>
            )
          ) : hasOtherStyle ? (
            <>
              <button
                onClick={tryOtherStyle}
                className="cab-btn-primary w-full px-6 py-4 font-unbounded text-[15px]"
              >
                {t.viewOther}
              </button>
              <button
                onClick={retry}
                className="w-full rounded-full border border-white/10 py-3 font-geologica text-[13px] text-cab-muted transition hover:border-white/30 hover:text-cab-text"
              >
                {t.retry}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={retry}
                className="cab-btn-primary w-full px-6 py-4 font-unbounded text-[15px]"
              >
                {t.retry}
              </button>
              <button
                onClick={() => router.push('/learn/study')}
                className="w-full rounded-full border border-white/10 py-3 font-geologica text-[13px] text-cab-muted transition hover:border-white/30 hover:text-cab-text"
              >
                {t.backToTopics}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h1 className="font-unbounded text-[20px] font-bold leading-tight text-cab-text">
        {title}
      </h1>
    </div>
  )
}
