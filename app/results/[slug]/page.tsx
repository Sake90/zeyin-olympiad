import { notFound } from 'next/navigation'
import { Onest, Geologica } from 'next/font/google'
import { Target, Clock, Shield, Trophy, BookOpen, Lightbulb, type LucideIcon } from 'lucide-react'
import ZeyinLogo from '@/components/ZeyinLogo'
import { createServiceClient } from '@/lib/supabase'
import type { BehaviorData } from '@/lib/behavior'
import { buildRecommendations, type Recommendation, type RecommendationIcon } from '@/lib/recommendations'
import { extractBehaviorForPrompt } from '@/lib/analysis-helpers'
import AnalysisLoader from './AnalysisLoader'

// Stages 1-2: hero, real percentile, subjects grid, math topic deep-dive.
// Stages 3-5 (behavior, observations, recommendation) are still placeholders.

// Russian labels for the 6 known math topics. DB stores them in Kazakh; for ru
// pages we translate, for kz we render the DB value as-is. Unknown topic keys
// fall back to the original string (defensive against typos / new topics).
const TOPIC_RU: Record<string, string> = {
  'Логика және заңдылықтар': 'Логика и закономерности',
  'Теңдеулер':              'Уравнения',
  'Санның бөлігін табу':    'Дроби и доли',
  'Пайыз':                  'Проценты',
  'Фигуралар':              'Фигуры',
  'Уақыт және қозғалыс':    'Время и движение',
}

const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-onest',
  display: 'swap',
})

const geologica = Geologica({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-geologica',
  display: 'swap',
})

interface SubjectScore { name_ru: string; name_kz: string; score: number; total: number }

type Tone = 'teal' | 'orange' | 'magenta'

function pickTone(pct: number): Tone {
  if (pct >= 70) return 'teal'
  if (pct >= 40) return 'orange'
  return 'magenta'
}

const TONE_FILL_GRADIENT: Record<Tone, string> = {
  teal:    'linear-gradient(90deg, #1ec8c8, #5eeaea)',
  orange:  'linear-gradient(90deg, #f47920, #ffb347)',
  magenta: 'linear-gradient(90deg, #d4145a, #ff4a8a)',
}

const TONE_SOLID: Record<Tone, string> = {
  teal:    '#1ec8c8',
  orange:  '#f47920',
  magenta: '#d4145a',
}

// Three observation dots cycle through brand tones as in the prototype.
const OBS_DOT_COLORS = ['#1ec8c8', '#f47920', '#d4145a']

// Recommendation icons rotate through the same brand tones, indexed by position.
const RECO_TONE_BY_INDEX = ['#1ec8c8', '#f47920', '#d4145a']

const RECO_ICON_COMPONENT: Record<RecommendationIcon, LucideIcon> = {
  target: Target,
  clock: Clock,
  shield: Shield,
  trophy: Trophy,
  book: BookOpen,
  lightbulb: Lightbulb,
}

// Builds wa.me URL with a pre-filled message ready to send. Number can include
// '+', spaces, or dashes — wa.me wants digits only, so we strip the rest.
function buildWhatsAppUrl(
  rawNumber: string,
  fullName: string,
  grade: string,
  score: number,
  total: number,
  lang: 'ru' | 'kz',
): string {
  const digits = rawNumber.replace(/\D/g, '')
  const message = lang === 'kz'
    ? `Сәлеметсіз бе! Олимпиада нәтижелері туралы толығырақ білгім келеді.\n\nОқушы: ${fullName}\nСынып: ${grade}\nБалл: ${score}/${total}\n\nҚандай курстар немесе бағыттарды ұсынасыздар?`
    : `Здравствуйте! Хочу узнать подробнее про результаты олимпиады.\n\nУченик: ${fullName}\nКласс: ${grade}\nБалл: ${score}/${total}\n\nКакие курсы или направления порекомендуете?`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

// Returns the 3 observation strings if analysis is fully shaped, otherwise
// null — covers in-flight lock state ({generating: true}) and any malformed row.
function extractObservations(analysis: unknown): [string, string, string] | null {
  if (!analysis || typeof analysis !== 'object') return null
  const obj = analysis as Record<string, unknown>
  const obs = obj.observations
  if (!Array.isArray(obs) || obs.length !== 3) return null
  if (!obs.every(o => typeof o === 'string' && o.length > 0)) return null
  return [obs[0] as string, obs[1] as string, obs[2] as string]
}

interface BehaviorCardView {
  icon: string
  label: string   // small uppercase header (Средняя скорость / Уверенность / Паттерн ошибок)
  value: string   // big white headline (Очень быстро / Высокая / etc) — "—" when missing
  note: string    // small muted subtitle below the value
}

// Three render modes:
//   - 'cards'        — full data, three behavior cards
//   - 'insufficient' — child answered < 15 questions (abandoned attempt)
//   - 'failed'       — calculator threw; behavior column flagged calc_failed
type BehaviorRender =
  | { mode: 'cards'; speed: BehaviorCardView; confidence: BehaviorCardView; pattern: BehaviorCardView }
  | { mode: 'insufficient'; message: string }
  | { mode: 'failed'; message: string }

// Treat anything that isn't a fully-shaped BehaviorData as missing — covers
// null, undefined, the { error: 'calc_failed' } marker, and rows from before
// the behavior block existed.
function isBehaviorReady(b: unknown): b is BehaviorData {
  if (!b || typeof b !== 'object') return false
  const any = b as Record<string, unknown>
  return (
    typeof any.avg_seconds_per_question === 'number' &&
    typeof any.speed_label === 'string' &&
    typeof any.confidence_label === 'string' &&
    typeof any.error_pattern === 'string'
  )
}

function buildBehaviorView(b: unknown, lang: 'ru' | 'kz'): BehaviorRender {
  const headers = lang === 'kz'
    ? { speed: 'Орташа жылдамдық', confidence: 'Сенімділік', pattern: 'Қателер үлгісі' }
    : { speed: 'Средняя скорость', confidence: 'Уверенность', pattern: 'Паттерн ошибок' }

  // Abandoned attempt: fewer than MIN_ANSWERS in the helper.
  if (b && typeof b === 'object' && (b as Record<string, unknown>).insufficient_data === true) {
    return {
      mode: 'insufficient',
      message: lang === 'kz'
        ? 'Талдау үшін деректер жеткіліксіз'
        : 'Недостаточно данных для анализа поведения',
    }
  }

  // Calculator threw — surfaced as { error: 'calc_failed' } from the API.
  if (b && typeof b === 'object' && (b as Record<string, unknown>).error === 'calc_failed') {
    return {
      mode: 'failed',
      message: lang === 'kz'
        ? 'Талдау сәтсіз болды'
        : 'Не удалось проанализировать',
    }
  }

  const empty = (label: string, icon: string): BehaviorCardView => ({ icon, label, value: '—', note: '' })

  // Anything else missing/malformed — show empty cards so layout doesn't shift.
  if (!isBehaviorReady(b)) {
    return {
      mode: 'cards',
      speed:      empty(headers.speed,      '⚡'),
      confidence: empty(headers.confidence, '🎯'),
      pattern:    empty(headers.pattern,    '📊'),
    }
  }

  const avg = b.avg_seconds_per_question

  // SPEED
  let speedValue: string, speedNote: string
  if (lang === 'kz') {
    if (b.speed_label === 'fast')      { speedValue = 'Өте жылдам'; speedNote = `${avg} сек/сұрақ — мұқият бол` }
    else if (b.speed_label === 'slow') { speedValue = 'Ойланып';    speedNote = `${avg} сек/сұрақ — жақсы ойланасың` }
    else                                { speedValue = 'Өз темпінде'; speedNote = `${avg} сек/сұрақ` }
  } else {
    if (b.speed_label === 'fast')      { speedValue = 'Очень быстро'; speedNote = `${avg} сек/вопрос — будь внимательнее` }
    else if (b.speed_label === 'slow') { speedValue = 'Вдумчиво';     speedNote = `${avg} сек/вопрос — отлично думаешь` }
    else                                { speedValue = 'В своём темпе'; speedNote = `${avg} сек/вопрос` }
  }

  // CONFIDENCE
  let confValue: string, confNote: string
  if (lang === 'kz') {
    if (b.confidence_label === 'high')     { confValue = 'Жоғары';        confNote = 'Тұрақты ырғақпен жауап бердің' }
    else if (b.confidence_label === 'low') { confValue = 'Әртүрлі ырғақ'; confNote = 'Кейбір сұрақтарға тым жылдам жауап бердің' }
    else                                    { confValue = 'Орташа';        confNote = 'Кейде жылдам, кейде ойландың' }
  } else {
    if (b.confidence_label === 'high')     { confValue = 'Высокая';     confNote = 'Стабильный темп ответов' }
    else if (b.confidence_label === 'low') { confValue = 'Разный ритм'; confNote = 'На какие-то вопросы отвечал быстро, на какие-то дольше' }
    else                                    { confValue = 'Средняя';     confNote = 'Где-то быстро, где-то задумывался' }
  }

  // PATTERN
  let patValue: string, patNote: string
  if (lang === 'kz') {
    if (b.error_pattern === 'weak_start')    { patValue = 'Басында қиын болды'; patNote = 'Соңында жақсы болды' }
    else if (b.error_pattern === 'weak_end') { patValue = 'Соңында шаршадың';  patNote = 'Жақсы бастадың, күшіңді сақта' }
    else                                      { patValue = 'Тұрақты';            patNote = 'Басынан соңына дейін бірдей' }
  } else {
    if (b.error_pattern === 'weak_start')    { patValue = 'Сложности в начале'; patNote = 'К концу освоился' }
    else if (b.error_pattern === 'weak_end') { patValue = 'Усталость к концу';  patNote = 'Хорошее начало, береги силы' }
    else                                      { patValue = 'Стабильно';          patNote = 'Одинаково от начала до конца' }
  }

  return {
    mode: 'cards',
    speed:      { icon: '⚡', label: headers.speed,      value: speedValue, note: speedNote },
    confidence: { icon: '🎯', label: headers.confidence, value: confValue,  note: confNote  },
    pattern:    { icon: '📊', label: headers.pattern,    value: patValue,   note: patNote   },
  }
}

const TONE_STATUS_CLASS: Record<Tone, string> = {
  teal: 'tag-good', orange: 'tag-ok', magenta: 'tag-weak',
}

function statusLabel(pct: number, lang: 'ru' | 'kz'): string | null {
  if (pct >= 100) return 'Максимум!'
  if (pct >= 80)  return lang === 'kz' ? 'Тамаша нәтиже'        : 'Отличный результат'
  if (pct >= 60)  return lang === 'kz' ? 'Жақсы деңгей'         : 'Хороший уровень'
  if (pct >= 40)  return lang === 'kz' ? 'Қабілетің бар, алға!' : 'Есть потенциал'
  return null   // <40%: weakness already shown by short magenta bar — silence is kinder
}

function levelBadge(pct: number, lang: 'ru' | 'kz'): string | null {
  if (pct > 70)  return lang === 'kz' ? '⭐ Күшті деңгей'    : '⭐ Сильный уровень'
  if (pct >= 40) return lang === 'kz' ? '🌱 Бастапқы кезең' : '🌱 Зона роста'
  return null   // <40%: hide entirely — “потенциал” reads as a let-down for parents
}

// Empathy-driven percentile display modes:
//   A (>=40%)   — full block: prefix + big % + label + level-badge + slider
//   B (20-40%)  — neutral motivational text + slider (no scary "0% better than" text)
//   C (<20%)    — replace block with a positive "Strength" card built from the
//                 strongest math topic (or strongest subject if topics absent)
type Mode = 'A' | 'B' | 'C'
function displayMode(percentile: number): Mode {
  if (percentile >= 40) return 'A'
  if (percentile >= 20) return 'B'
  return 'C'
}

function formatHeaderDate(iso: string | null, lang: 'ru' | 'kz'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const months = lang === 'kz'
    ? ['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан']
    : ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export const dynamic = 'force-dynamic'

export default async function ResultsBySlugPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug)

  const db = createServiceClient()

  const { data: result } = await db
    .from('results')
    .select('id, student_id, olympiad_id, score, total_questions, subject_scores, completed_at, slug, is_test, behavior, analysis')
    .eq('slug', slug)
    .single()

  if (!result) notFound()

  // is_test may be NULL on legacy rows; fall back to false so percentile stays
  // bucketed against real participants.
  const isTest = result.is_test ?? false

  const [
    { data: student },
    { data: olympiad },
    { data: answers },
    { data: mathQuestions },
    { count: lowerCount },
    { count: totalCount },
  ] = await Promise.all([
    db.from('students')
      .select('full_name, grade, school, language')
      .eq('id', result.student_id)
      .single(),
    db.from('olympiads')
      .select('name_ru, name_kz, start_time')
      .eq('id', result.olympiad_id)
      .single(),
    db.from('answers')
      .select('question_id, selected_option')
      .eq('student_id', result.student_id),
    // NOTE: фильтрация по topic IS NOT NULL сейчас работает потому что
    // только математика имеет topic. Если в будущем topic появится у
    // других предметов, этот блок надо будет переделать на
    // .eq('subject', 'math')
    db.from('questions')
      .select('id, topic, correct_option')
      .eq('olympiad_id', result.olympiad_id)
      .not('topic', 'is', null),
    db.from('results')
      .select('*', { count: 'exact', head: true })
      .eq('olympiad_id', result.olympiad_id)
      .eq('is_test', isTest)
      .lt('score', result.score),
    db.from('results')
      .select('*', { count: 'exact', head: true })
      .eq('olympiad_id', result.olympiad_id)
      .eq('is_test', isTest),
  ])

  if (!student || !olympiad) notFound()

  const lang: 'ru' | 'kz' = student.language === 'kz' ? 'kz' : 'ru'
  const score = result.score ?? 0
  const total = result.total_questions ?? 1
  const pct = total > 0 ? (score / total) * 100 : 0
  const ringTone = pickTone(pct)

  // Real percentile — bucketed by is_test so test profiles stay separate from
  // production. Capped at 99% so we never tell a top student "лучше чем 100%",
  // which reads weird and isn't meaningfully different from 99%.
  const totalSample = totalCount ?? 0
  const lowerSample = lowerCount ?? 0
  const percentile = totalSample > 0
    ? Math.min(99, Math.max(0, Math.round((lowerSample / totalSample) * 100)))
    : 0
  const percentileTone: Tone = pickTone(percentile)

  // Math topic deep-dive: aggregate answers + questions in memory.
  // Each math question has a non-null topic; group by topic, count correct.
  const answersByQ = new Map<string, string | null>(
    (answers ?? []).map(a => [a.question_id, a.selected_option])
  )
  const topicAgg = new Map<string, { correct: number; total: number }>()
  for (const q of mathQuestions ?? []) {
    if (!q.topic) continue
    const cur = topicAgg.get(q.topic) ?? { correct: 0, total: 0 }
    cur.total += 1
    if (answersByQ.get(q.id) === q.correct_option) cur.correct += 1
    topicAgg.set(q.topic, cur)
  }
  const topicPerformance = Array.from(topicAgg.entries())
    .map(([topic, v]) => {
      const tPct = v.total > 0 ? (v.correct / v.total) * 100 : 0
      return {
        topic,
        label: lang === 'ru' ? (TOPIC_RU[topic] ?? topic) : topic,
        correct: v.correct,
        total: v.total,
        pct: tPct,
        tone: pickTone(tPct),
      }
    })
    .sort((a, b) => a.pct - b.pct)   // weakest first — parents see problems immediately

  const subjects: SubjectScore[] = Array.isArray(result.subject_scores) ? result.subject_scores : []
  const olympiadName = lang === 'kz' ? olympiad.name_kz : olympiad.name_ru
  const startDate = formatHeaderDate(olympiad.start_time, lang)

  const mode: Mode = displayMode(percentile)

  // Strength card (mode C only): pick the strongest math topic, or fall back
  // to the strongest subject if math topics aren't tagged in this olympiad.
  type Strength =
    | { kind: 'topic'; label: string; pctText: string }
    | { kind: 'subject'; label: string; pctText: string }
  let strength: Strength | null = null
  if (mode === 'C') {
    if (topicPerformance.length > 0) {
      // topicPerformance is sorted weakest→strongest; last item is the best.
      const best = topicPerformance[topicPerformance.length - 1]
      strength = { kind: 'topic', label: best.label, pctText: `${Math.round(best.pct)}%` }
    } else if (subjects.length > 0) {
      const best = subjects.reduce((m, c) => {
        const cp = c.total > 0 ? c.score / c.total : 0
        const mp = m.total > 0 ? m.score / m.total : 0
        return cp > mp ? c : m
      }, subjects[0])
      strength = {
        kind: 'subject',
        label: lang === 'kz' ? best.name_kz : best.name_ru,
        pctText: `${best.score}/${best.total}`,
      }
    }
  }

  const t = lang === 'kz'
    ? {
        persReport: 'Жеке есеп',
        of: '/ ',
        // Hardcoded 'тен' — works for current olympiad (total=35, ends in 5).
        // Generalize later if other olympiads use different totals.
        scoreSuffix: (n: number) => `${n}-тен`,
        bySubjects: 'Пәндер бойынша',
        pctPrefix: '',                         // empty — kz fits in one line
        pctOf: 'оқушылардан жоғары',
        onlineTour: 'Онлайн тур',
        gradeLabel: (g: string) => `${g} сынып`,
        testBadge: '🧪 ТЕСТТІК ПРОФИЛЬ',
        modeBText: 'Олимпиаданы аяқтадыңыз — бұл алға қадам!',
        strengthTitleTopic: '🌟 Күшті жағы',
        strengthTitleSubject: '🌟 Күшті пәні',
        strengthSub: 'Осыдан бастаймыз — мұнан өсу оңай болады',
        mathDeepTitle: '🔢 Математика — толық талдау',
        behaviorTitle: 'Олимпиада кезіндегі тәртіп',
        observationsTitle: 'Бақылаулар',
        observationsPreparing: 'Талдау дайындалуда...',
        recoTitle: 'Нәтижені қалай жақсартуға болады?',
        recoBottom: 'Дәл қазір бізге жазыңыз. Менеджеріміз сізге жеке кеңес береді.',
        ctaText: 'Толық талдау алу',
        ctaHint: 'WhatsApp-та ашылады',
        ctaUnavailable: 'Жақында қолжетімді',
        footer: 'Бұл есеп қатысушының жауаптары негізінде автоматты түрде құралған',
      }
    : {
        persReport: 'Персональный отчёт',
        of: 'из ',
        scoreSuffix: (n: number) => `из ${n}`,
        bySubjects: 'По предметам',
        pctPrefix: 'Лучше чем',
        pctOf: 'участников',
        onlineTour: 'Онлайн тур',
        gradeLabel: (g: string) => `${g} класс`,
        testBadge: '🧪 ТЕСТОВЫЙ ПРОФИЛЬ',
        modeBText: 'Прошли олимпиаду — это шаг вперёд!',
        strengthTitleTopic: '🌟 Сильная сторона',
        strengthTitleSubject: '🌟 Сильный предмет',
        strengthSub: 'С этого начинаем — отсюда расти будет легче',
        mathDeepTitle: '🔢 Математика — детальный разбор',
        behaviorTitle: 'Анализ поведения во время олимпиады',
        observationsTitle: 'Наблюдения',
        observationsPreparing: 'Готовим анализ...',
        recoTitle: 'Как подтянуть результат?',
        recoBottom: 'Напишите нам прямо сейчас. Наш менеджер вас лично проконсультирует.',
        ctaText: 'Получить подробный разбор',
        ctaHint: 'Откроется в WhatsApp',
        ctaUnavailable: 'Скоро доступно',
        footer: 'Этот отчёт сформирован автоматически на основе ответов участника',
      }

  // SVG ring math: r=52 → circumference ≈ 326.7
  const RING_LEN = 326
  const ringOffset = RING_LEN * (1 - pct / 100)

  const levelBadgeText = levelBadge(percentile, lang)
  const behaviorView = buildBehaviorView(result.behavior, lang)
  const observations = extractObservations(result.analysis)

  // Build recommendations on the server, deterministically. AnalysisInput is
  // assembled inline from data we already have on the page — no extra DB calls.
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0
  const gradeNum = Number.parseInt(student.grade ?? '', 10)
  const promptLang: 'ru' | 'kk' = lang === 'kz' ? 'kk' : 'ru'
  const recommendations: Recommendation[] = buildRecommendations({
    full_name: student.full_name,
    grade: Number.isFinite(gradeNum) ? gradeNum : 5,
    language: promptLang,
    score,
    total_questions: total,
    accuracy_percent: accuracy,
    subject_scores: subjects.map(s => ({
      name: lang === 'kz' ? s.name_kz : s.name_ru,
      score: s.score,
      total: s.total,
    })),
    math_topics: topicPerformance.map(t => ({ name: t.topic, percent: t.pct })),
    behavior: extractBehaviorForPrompt(result.behavior),
  })

  // WhatsApp CTA: env-driven, server-rendered link. If no number is configured
  // (e.g. preview env), button renders as disabled "soon" text rather than
  // shipping a broken link to production.
  const whatsappNumber = process.env.ZEYIN_WHATSAPP_NUMBER ?? ''
  const whatsappUrl = whatsappNumber
    ? buildWhatsAppUrl(whatsappNumber, student.full_name, student.grade ?? '', score, total, lang)
    : null

  return (
    <div className={`${onest.variable} ${geologica.variable} results-root`}>
      {/* dangerouslySetInnerHTML avoids React's text-content hydration mismatch:
          server escapes apostrophes inside <style>{...}, client doesn't, so the
          rendered HTML diverges. */}
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />

      <div className="page">

        {/* HEADER */}
        <div className="header">
          <div className="brand brand-logo">
            <ZeyinLogo size={70} />
          </div>
          <div className="header-badge">
            <span className="hb-icon">🏆</span>
            <div className="hb-text">
              <div className="hb-title">{olympiadName}</div>
              {startDate && <div className="hb-sub">{startDate} · {t.onlineTour}</div>}
            </div>
          </div>
        </div>

        {result.is_test && (
          <div className="test-banner">{t.testBadge}</div>
        )}

        {/* HERO */}
        <div className="hero">
          <div className="hero-text">
            <div className="hero-label">{t.persReport}</div>
            <div className="hero-name">{student.full_name}</div>
            <div className="hero-sub">
              {student.grade && <span>{t.gradeLabel(student.grade)}</span>}
              {student.school && <span>{student.school}</span>}
              <span>{t.onlineTour}</span>
            </div>
          </div>
          <div className="score-ring">
            <svg viewBox="0 0 130 130">
              <defs>
                <linearGradient id="ring-grad-teal" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1ec8c8"/>
                  <stop offset="100%" stopColor="#5eeaea"/>
                </linearGradient>
                <linearGradient id="ring-grad-orange" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f47920"/>
                  <stop offset="100%" stopColor="#ffb347"/>
                </linearGradient>
                <linearGradient id="ring-grad-magenta" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d4145a"/>
                  <stop offset="100%" stopColor="#ff4a8a"/>
                </linearGradient>
              </defs>
              <circle className="track" cx={65} cy={65} r={52} />
              <circle
                className="fill"
                cx={65} cy={65} r={52}
                stroke={`url(#ring-grad-${ringTone})`}
                strokeDasharray={RING_LEN}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <div className="score-center">
              <div className="score-num">{score}</div>
              <div className="score-total">{t.scoreSuffix(total)}</div>
            </div>
          </div>
        </div>

        {/* MODE A — full percentile block. Rendered only at percentile >= 40%
            so a low absolute number ("33% оқушылардан жоғары") never reads as
            a put-down for almost-top scorers in tiny test cohorts. */}
        {mode === 'A' && (
          <div className="percentile-card">
            <div className="percentile-text">
              {t.pctPrefix && <div className="pct-prefix">{t.pctPrefix}</div>}
              <div className="big">{percentile}%</div>
              <div className="label">{t.pctOf}</div>
            </div>
            {levelBadgeText && <div className="level-badge">{levelBadgeText}</div>}
            <div className="percentile-bar-wrap">
              <div className="perc-bar-container">
                <div className="perc-tooltip" style={{ left: `${percentile}%` }}>
                  {student.full_name.split(' ')[0]} · {percentile}%
                </div>
                <div className="perc-pin" style={{ left: `${percentile}%` }} />
                <div className="perc-track">
                  <div
                    className="perc-fill"
                    style={{
                      width: `${percentile}%`,
                      background: TONE_FILL_GRADIENT[percentileTone],
                    }}
                  />
                </div>
              </div>
              <div className="perc-marker">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* MODE B — neutral motivational text + slider.
            Number is hidden but the pin keeps showing relative position. */}
        {mode === 'B' && (
          <div className="percentile-card mode-b">
            <div className="motivational-text">{t.modeBText}</div>
            <div className="percentile-bar-wrap">
              <div className="perc-bar-container">
                <div className="perc-tooltip" style={{ left: `${percentile}%` }}>
                  {student.full_name.split(' ')[0]} · {percentile}%
                </div>
                <div className="perc-pin" style={{ left: `${percentile}%` }} />
                <div className="perc-track">
                  <div
                    className="perc-fill"
                    style={{
                      width: `${percentile}%`,
                      background: TONE_FILL_GRADIENT[percentileTone],
                    }}
                  />
                </div>
              </div>
              <div className="perc-marker">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* MODE C — replace percentile block entirely with a positive
            "strength" anchor: best math topic (or fallback to best subject). */}
        {mode === 'C' && strength && (
          <div className="strength-card">
            <div className="strength-title">
              {strength.kind === 'topic' ? t.strengthTitleTopic : t.strengthTitleSubject}
            </div>
            <div className="strength-name">{strength.label}</div>
            <div className="strength-pct">{strength.pctText}</div>
            <div className="strength-sub">{t.strengthSub}</div>
          </div>
        )}

        {/* SUBJECTS */}
        <div className="section-title">{t.bySubjects}</div>
        <div className="subjects-grid">
          {subjects.map((s, i) => {
            const subPct = s.total > 0 ? (s.score / s.total) * 100 : 0
            const tone = pickTone(subPct)
            const tag = statusLabel(subPct, lang)
            return (
              <div className="subject-card" key={i}>
                <div className="subject-head">
                  <div>
                    <div className="subject-name">{lang === 'kz' ? s.name_kz : s.name_ru}</div>
                    <div className="subject-score">
                      {s.score} <span>/ {s.total}</span>
                    </div>
                  </div>
                </div>
                <div className="subject-bar">
                  <div
                    className="subject-bar-fill"
                    style={{
                      width: `${subPct}%`,
                      background: TONE_FILL_GRADIENT[tone],
                    }}
                  />
                </div>
                {tag && (
                  <span className={`status-tag ${TONE_STATUS_CLASS[tone]}`}>{tag}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* MATH DEEP DIVE — only render when math questions are tagged with topics. */}
        {topicPerformance.length > 0 && (
          <div className="deep-card">
            <div className="deep-header">
              <div className="deep-title">{t.mathDeepTitle}</div>
            </div>
            {topicPerformance.map(tp => (
              <div className="topic-row" key={tp.topic}>
                <div className="topic-name">{tp.label}</div>
                <div className="topic-bar-wrap">
                  <div className="topic-bar">
                    <div
                      className="topic-bar-fill"
                      style={{ width: `${tp.pct}%`, background: TONE_SOLID[tp.tone] }}
                    />
                  </div>
                </div>
                <div className="topic-pct" style={{ color: TONE_SOLID[tp.tone] }}>
                  {Math.round(tp.pct)}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BEHAVIOR — three cards, neutral plate for abandoned attempts,
            or error plate if the calculator threw. */}
        <div className="section-title">{t.behaviorTitle}</div>
        {behaviorView.mode === 'cards' ? (
          <div className="behavior-grid">
            {([behaviorView.speed, behaviorView.confidence, behaviorView.pattern]).map((c, i) => (
              <div className="beh-card" key={i}>
                <div className="beh-icon">{c.icon}</div>
                <div className="beh-label">{c.label}</div>
                <div className="beh-value">{c.value}</div>
                {c.note && <div className="beh-note">{c.note}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="placeholder">{behaviorView.message}</div>
        )}

        {/* OBSERVATIONS — AI-generated, lazy. While analysis is missing we
            show a "preparing" plate and the client loader polls the endpoint
            which kicks off generation on first hit, then router.refresh()'s
            the page once it's persisted. */}
        {observations ? (
          <>
            <div className="section-title">{t.observationsTitle}</div>
            <div className="obs-list">
              {observations.map((text, i) => (
                <div className="obs-item" key={i}>
                  <div className="obs-dot" style={{ background: OBS_DOT_COLORS[i] }} />
                  <div className="obs-text">{text}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="section-title">{t.observationsTitle}</div>
            <div className="placeholder placeholder-pulse">{t.observationsPreparing}</div>
            <AnalysisLoader slug={slug} />
          </>
        )}

        {/* RECOMMENDATIONS + WHATSAPP CTA */}
        <div className="reco-card">
          <div className="reco-title">{t.recoTitle}</div>
          <div className="reco-steps">
            {recommendations.map((rec, i) => {
              const Icon = RECO_ICON_COMPONENT[rec.icon]
              const tone = RECO_TONE_BY_INDEX[i % 3]
              return (
                <div className="reco-step" key={i}>
                  <div
                    className="rs-icon"
                    style={{
                      background: `${tone}1f`,           /* 12% alpha */
                      borderColor: `${tone}40`,           /* 25% alpha */
                      color: tone,
                    }}
                  >
                    <Icon size={16} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="rs-title">{lang === 'kz' ? rec.title_kk : rec.title_ru}</div>
                    <div className="rs-desc">{lang === 'kz' ? rec.text_kk : rec.text_ru}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="reco-divider" />

          <div className="reco-bottom">
            <div className="reco-bottom-text">{t.recoBottom}</div>
            {whatsappUrl ? (
              <a href={whatsappUrl} className="cta-btn" target="_blank" rel="noopener noreferrer">
                <span className="cta-icon">💬</span>
                <span>{t.ctaText}</span>
                <span className="cta-arrow">→</span>
              </a>
            ) : (
              <button type="button" className="cta-btn cta-btn-disabled" disabled>
                <span className="cta-icon">💬</span>
                <span>{t.ctaUnavailable}</span>
              </button>
            )}
            {whatsappUrl && <div className="cta-hint">{t.ctaHint}</div>}
          </div>
        </div>

        <div className="footer">{t.footer}</div>
      </div>
    </div>
  )
}

// Scoped styles — copied 1:1 from zeyin-analysis-report-v6.html, prefixed under .results-root
// so we don't pollute :root globals or other pages.
const REPORT_CSS = `
.results-root {
  --teal: #1ec8c8;
  --magenta: #d4145a;
  --orange: #f47920;
  --bg: #0a0d14;
  --card: #111520;
  --card2: #161b2a;
  --border: rgba(30,200,200,0.12);
  --text: #e8eaf0;
  --muted: #6b7280;

  background: var(--bg);
  color: var(--text);
  font-family: var(--font-geologica), 'Geologica', sans-serif;
  font-weight: 400;
  min-height: 100vh;
  padding: 32px 20px;
  padding-left: max(20px, env(safe-area-inset-left));
  padding-right: max(20px, env(safe-area-inset-right));
  padding-top: max(32px, env(safe-area-inset-top));
  padding-bottom: max(32px, env(safe-area-inset-bottom));
  background-image:
    radial-gradient(ellipse 800px 500px at 10% 0%, rgba(30,200,200,0.06) 0%, transparent 60%),
    radial-gradient(ellipse 600px 400px at 90% 100%, rgba(212,20,90,0.05) 0%, transparent 60%);
}
.results-root * { box-sizing: border-box; }
.results-root .page { max-width: 820px; margin: 0 auto; }

.results-root .header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 32px; padding-bottom: 22px; gap: 16px; position: relative;
}
.results-root .header::after {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(30,200,200,0.28) 25%, rgba(212,20,90,0.22) 75%, transparent 100%);
}
.results-root .brand { display: flex; align-items: center; flex-shrink: 0; }
.results-root .brand-logo img {
  width: 70px; height: 70px; display: block;
  filter: drop-shadow(0 6px 16px rgba(30,200,200,0.18));
}
.results-root .header-badge {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 9px 14px 9px 12px;
  background: rgba(30,200,200,0.08); border: 1px solid rgba(30,200,200,0.22);
  border-radius: 12px; position: relative; overflow: hidden;
}
.results-root .header-badge::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(30,200,200,0.06), transparent 60%);
  pointer-events: none;
}
.results-root .hb-icon { font-size: 18px; filter: drop-shadow(0 0 6px rgba(30,200,200,0.35)); position: relative; }
.results-root .hb-text { display: flex; flex-direction: column; gap: 2px; line-height: 1.15; text-align: right; position: relative; }
.results-root .hb-title {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--teal);
}
.results-root .hb-sub { font-size: 11px; color: var(--muted); }

.results-root .test-banner {
  display: inline-block;
  margin: -16px 0 24px;
  padding: 8px 16px;
  background: rgba(244,121,32,0.15);
  border: 1px solid rgba(244,121,32,0.4);
  border-radius: 99px;
  color: #ffb347;
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
}

.results-root .hero {
  background: var(--card); border: 1px solid var(--border); border-radius: 20px;
  padding: 28px 24px; margin-bottom: 20px;
  display: flex; gap: 20px; align-items: center; justify-content: space-between;
  position: relative; overflow: hidden;
}
.results-root .hero::before {
  content: ''; position: absolute; top: -60px; right: -60px;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(30,200,200,0.08), transparent 70%);
  pointer-events: none;
}
.results-root .hero-text { min-width: 0; flex: 1; }
.results-root .hero-label {
  font-size: 11px; font-weight: 600; letter-spacing: 2px;
  text-transform: uppercase; color: var(--teal); margin-bottom: 8px;
}
.results-root .hero-name {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 26px; font-weight: 700; color: #fff; margin-bottom: 10px;
  line-height: 1.15; word-wrap: break-word;
}
.results-root .hero-sub {
  font-size: 13px; color: var(--muted); display: flex; gap: 8px 16px; flex-wrap: wrap;
}
.results-root .hero-sub span { display: inline-flex; align-items: center; gap: 6px; }
.results-root .hero-sub span::before { content: '•'; color: var(--teal); font-size: 14px; }
.results-root .hero-sub span:first-child::before { display: none; }

.results-root .score-ring { width: 130px; height: 130px; position: relative; flex-shrink: 0; }
.results-root .score-ring svg { transform: rotate(-90deg); width: 100%; height: 100%; }
.results-root .score-ring .track { fill: none; stroke: rgba(255,255,255,0.06); stroke-width: 8; }
.results-root .score-ring .fill {
  fill: none; stroke-width: 8; stroke-linecap: round;
  filter: drop-shadow(0 0 6px rgba(30,200,200,0.5));
  transition: stroke-dashoffset 0.6s ease;
}
.results-root .score-center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.results-root .score-num {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 30px; font-weight: 900; color: #fff; line-height: 1;
}
.results-root .score-total { font-size: 12px; color: var(--muted); margin-top: 2px; }

.results-root .percentile-card {
  background: var(--card); border: 1px solid var(--border); border-radius: 16px;
  padding: 22px 24px; margin-bottom: 20px;
  display: grid; grid-template-columns: auto 1fr auto;
  align-items: center; gap: 24px;
}
.results-root .percentile-text { display: flex; flex-direction: column; align-items: flex-start; gap: 0; flex-shrink: 0; }
.results-root .pct-prefix {
  font-size: 11px; color: var(--muted); text-transform: uppercase;
  letter-spacing: 1.5px; font-weight: 600; margin-bottom: 4px;
}
.results-root .percentile-text .big {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 44px; font-weight: 900;
  background: linear-gradient(135deg, var(--teal), #5eeaea);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  line-height: 1; letter-spacing: -1px;
}
.results-root .percentile-text .label { font-size: 13px; color: var(--muted); margin-top: 4px; }
.results-root .percentile-bar-wrap { min-width: 0; }
.results-root .perc-bar-container { position: relative; padding-top: 36px; }
.results-root .perc-track {
  height: 10px; background: rgba(255,255,255,0.06);
  border-radius: 99px; position: relative; overflow: hidden;
}
.results-root .perc-fill { height: 100%; border-radius: 99px; box-shadow: 0 0 12px rgba(30,200,200,0.4); }
.results-root .perc-pin {
  position: absolute; top: 36px; width: 18px; height: 18px;
  background: #fff; border: 3px solid var(--teal); border-radius: 50%;
  transform: translate(-50%, -4px);
  box-shadow: 0 0 0 4px rgba(30,200,200,0.18), 0 2px 10px rgba(0,0,0,0.4);
  z-index: 2; pointer-events: none;
}
.results-root .perc-pin::after {
  content: ''; position: absolute; inset: 3px; border-radius: 50%;
  background: var(--teal); box-shadow: 0 0 8px var(--teal);
  animation: pinPulse 2s ease-in-out infinite;
}
@keyframes pinPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.6; transform: scale(0.75); }
}
.results-root .perc-tooltip {
  position: absolute; top: 0; transform: translateX(-50%);
  background: linear-gradient(135deg, var(--teal), #0fa8a8);
  color: #0a0d14;
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
  padding: 6px 12px; border-radius: 8px; white-space: nowrap;
  box-shadow: 0 4px 14px rgba(30,200,200,0.4); z-index: 3; pointer-events: none;
}
.results-root .perc-tooltip::after {
  content: ''; position: absolute; top: 100%; left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent; border-top-color: #0fa8a8;
}
.results-root .perc-marker {
  font-size: 11px; color: var(--muted);
  display: flex; justify-content: space-between; margin-top: 10px; gap: 4px;
}
.results-root .perc-marker span { white-space: nowrap; }
.results-root .level-badge {
  padding: 6px 14px; border-radius: 99px;
  font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
  background: rgba(30,200,200,0.12); border: 1px solid rgba(30,200,200,0.3);
  color: var(--teal); white-space: nowrap; flex-shrink: 0;
}

.results-root .section-title {
  font-size: 11px; font-weight: 600; letter-spacing: 2.5px;
  text-transform: uppercase; color: var(--muted); margin-bottom: 14px;
}
.results-root .subjects-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;
}
.results-root .subject-card {
  background: var(--card); border: 1px solid var(--border); border-radius: 16px;
  padding: 18px 20px; transition: border-color 0.2s;
}
.results-root .subject-card:hover { border-color: rgba(30,200,200,0.3); }
.results-root .subject-head {
  display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;
}
.results-root .subject-name { font-size: 13px; font-weight: 600; color: var(--text); }
.results-root .subject-score {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 22px; font-weight: 700; color: #fff; margin-top: 6px;
}
.results-root .subject-score span { font-size: 12px; font-weight: 400; color: var(--muted); }
.results-root .subject-bar {
  height: 4px; background: rgba(255,255,255,0.06);
  border-radius: 99px; margin-top: 12px; overflow: hidden;
}
.results-root .subject-bar-fill { height: 100%; border-radius: 99px; }
.results-root .tag-good { background: rgba(30,200,200,0.15); color: var(--teal); border: 1px solid rgba(30,200,200,0.25); }
.results-root .tag-ok   { background: rgba(244,121,32,0.15); color: var(--orange); border: 1px solid rgba(244,121,32,0.25); }
.results-root .tag-weak { background: rgba(212,20,90,0.15); color: var(--magenta); border: 1px solid rgba(212,20,90,0.25); }
.results-root .status-tag {
  font-size: 10px; font-weight: 600; letter-spacing: 0.5px;
  text-transform: uppercase; padding: 3px 10px; border-radius: 99px;
  margin-top: 10px; display: inline-block;
}

.results-root .placeholder {
  background: var(--card); border: 1px dashed rgba(30,200,200,0.18);
  border-radius: 16px; padding: 24px; margin-bottom: 12px;
  color: var(--muted); font-size: 13px; text-align: center; font-style: italic;
}

@keyframes obsPulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
.results-root .placeholder-pulse { animation: obsPulse 1.6s ease-in-out infinite; }

/* ── OBSERVATIONS ───────────────────────────────────────── */
.results-root .obs-list {
  margin-bottom: 20px; display: flex; flex-direction: column; gap: 10px;
}
.results-root .obs-item {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; padding: 14px 18px;
  display: flex; gap: 14px; align-items: flex-start;
}
.results-root .obs-dot {
  width: 8px; height: 8px; border-radius: 50%;
  margin-top: 6px; flex-shrink: 0;
}
.results-root .obs-text { font-size: 13px; line-height: 1.6; color: #c5cad8; }

/* ── PERCENTILE MODE B — neutral motivational state ─────── */
.results-root .percentile-card.mode-b { grid-template-columns: auto 1fr; }
.results-root .motivational-text {
  font-size: 14px; line-height: 1.5; color: var(--text);
  font-weight: 500; max-width: 220px;
}

/* ── PERCENTILE MODE C — strength card replaces the block ── */
.results-root .strength-card {
  background: rgba(30,200,200,0.08);
  border: 1px solid rgba(30,200,200,0.25);
  border-radius: 20px;
  padding: 24px 28px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}
.results-root .strength-card::before {
  content: ''; position: absolute; top: -60px; right: -60px;
  width: 220px; height: 220px;
  background: radial-gradient(circle, rgba(30,200,200,0.12), transparent 70%);
  pointer-events: none;
}
.results-root .strength-title {
  font-size: 11px; font-weight: 600; letter-spacing: 1.5px;
  text-transform: uppercase; color: var(--teal); margin-bottom: 12px;
  position: relative;
}
.results-root .strength-name {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 26px; font-weight: 700; color: #fff;
  line-height: 1.2; margin-bottom: 6px; position: relative;
}
.results-root .strength-pct {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 18px; font-weight: 700; color: var(--teal);
  margin-bottom: 14px; position: relative;
}
.results-root .strength-sub {
  font-size: 13px; line-height: 1.6; color: var(--muted); position: relative;
}

/* ── MATH DEEP DIVE ─────────────────────────────────────── */
.results-root .deep-card {
  background: var(--card); border: 1px solid var(--border); border-radius: 20px;
  padding: 24px; margin-bottom: 20px;
}
.results-root .deep-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
}
.results-root .deep-title {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 16px; font-weight: 700; color: #fff; line-height: 1.3;
}
.results-root .topic-row {
  display: grid; grid-template-columns: 1fr 140px 40px;
  align-items: center; gap: 14px;
  padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.results-root .topic-row:last-child { border-bottom: none; }
.results-root .topic-name { font-size: 13px; color: var(--text); line-height: 1.4; }
.results-root .topic-bar-wrap { width: 100%; }
.results-root .topic-bar {
  height: 5px; background: rgba(255,255,255,0.06);
  border-radius: 99px; overflow: hidden;
}
.results-root .topic-bar-fill { height: 100%; border-radius: 99px; }
.results-root .topic-pct {
  font-size: 13px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums;
}

/* ── BEHAVIOR ───────────────────────────────────────────── */
.results-root .behavior-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px; margin-bottom: 20px;
}
.results-root .beh-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 14px; padding: 18px 14px; text-align: center;
}
.results-root .beh-icon { font-size: 22px; margin-bottom: 8px; }
.results-root .beh-label {
  font-size: 10px; color: var(--muted);
  text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;
}
.results-root .beh-value {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 16px; font-weight: 700; color: #fff; line-height: 1.2;
}
.results-root .beh-note {
  font-size: 10px; color: var(--muted);
  margin-top: 4px; line-height: 1.3;
}

.results-root .reco-card {
  background: linear-gradient(135deg, rgba(30,200,200,0.08), rgba(212,20,90,0.05));
  border: 1px solid rgba(30,200,200,0.2); border-radius: 20px;
  padding: 28px; margin-bottom: 20px; position: relative; overflow: hidden;
}
.results-root .reco-card::before {
  content: ''; position: absolute; bottom: -80px; right: -80px;
  width: 250px; height: 250px;
  background: radial-gradient(circle, rgba(212,20,90,0.08), transparent 70%);
  pointer-events: none;
}
.results-root .reco-title {
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 14px; position: relative;
}
.results-root .reco-text {
  font-size: 14px; line-height: 1.7; color: #c5cad8;
  margin-bottom: 20px; max-width: 560px; position: relative;
}
.results-root .reco-steps {
  display: flex; flex-direction: column; gap: 0;
  margin-bottom: 24px; position: relative;
}
.results-root .reco-step {
  display: flex; gap: 16px; align-items: flex-start;
  padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
  position: relative;
}
.results-root .reco-step:last-child { border-bottom: none; }
.results-root .rs-icon {
  width: 32px; height: 32px; border-radius: 10px;
  border: 1px solid; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 2px;
}
.results-root .rs-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 4px; }
.results-root .rs-desc  { font-size: 13px; line-height: 1.55; color: var(--muted); }
.results-root .reco-divider {
  height: 1px; margin-bottom: 22px;
  background: linear-gradient(90deg,
    transparent 0%, rgba(30,200,200,0.2) 40%,
    rgba(212,20,90,0.15) 70%, transparent 100%);
}
.results-root .reco-bottom { position: relative; }
.results-root .reco-bottom-text {
  font-size: 14px; line-height: 1.65; color: #c5cad8; margin-bottom: 18px;
}
.results-root .cta-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  background: linear-gradient(135deg, var(--teal), #0fa8a8); color: #0a0d14;
  font-family: var(--font-onest), 'Onest', sans-serif;
  font-size: 13px; font-weight: 700; padding: 14px 22px;
  border-radius: 99px; cursor: pointer; border: none;
  box-shadow: 0 0 24px rgba(30,200,200,0.3); letter-spacing: 0.3px;
  position: relative; transition: transform 0.15s, box-shadow 0.15s;
  text-decoration: none;
}
.results-root .cta-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 28px rgba(30,200,200,0.4); }
.results-root .cta-btn:active { transform: translateY(0); }
.results-root .cta-btn-disabled,
.results-root .cta-btn-disabled:hover {
  background: rgba(255,255,255,0.06); color: var(--muted);
  box-shadow: none; cursor: not-allowed; transform: none;
}
.results-root .cta-icon { font-size: 16px; line-height: 1; }
.results-root .cta-arrow { font-weight: 700; transition: transform 0.2s; }
.results-root .cta-btn:hover .cta-arrow { transform: translateX(3px); }
.results-root .cta-hint {
  font-size: 11px; color: var(--muted); margin-top: 10px;
  position: relative; display: flex; align-items: center; gap: 6px;
}
.results-root .cta-hint::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: #25d366; box-shadow: 0 0 6px rgba(37,211,102,0.6);
}

.results-root .footer {
  text-align: center; font-size: 12px; color: var(--muted);
  padding-top: 20px; border-top: 1px solid var(--border); line-height: 1.8;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.results-root .hero            { animation: fadeUp 0.5s ease both 0.0s; }
.results-root .percentile-card { animation: fadeUp 0.5s ease both 0.1s; }
.results-root .strength-card   { animation: fadeUp 0.5s ease both 0.1s; }
.results-root .subjects-grid   { animation: fadeUp 0.5s ease both 0.2s; }
.results-root .deep-card       { animation: fadeUp 0.5s ease both 0.3s; }
.results-root .behavior-grid   { animation: fadeUp 0.5s ease both 0.35s; }
.results-root .obs-list        { animation: fadeUp 0.5s ease both 0.4s; }
.results-root .placeholder     { animation: fadeUp 0.5s ease both 0.4s; }
.results-root .reco-card       { animation: fadeUp 0.5s ease both 0.45s; }

@media (max-width: 640px) {
  .results-root { padding: 20px 16px; }
  .results-root .header { margin-bottom: 24px; padding-bottom: 18px; }
  .results-root .brand-logo img { width: 60px; height: 60px; }
  .results-root .header-badge { padding: 7px 12px 7px 10px; gap: 8px; }
  .results-root .hb-icon { font-size: 16px; }
  .results-root .hb-title { font-size: 9px; letter-spacing: 1px; }
  .results-root .hb-sub { font-size: 10px; }

  .results-root .hero { flex-direction: column; align-items: center; text-align: center; padding: 28px 22px; gap: 22px; }
  .results-root .hero-text { order: 2; width: 100%; }
  .results-root .score-ring { order: 1; width: 120px; height: 120px; }
  .results-root .score-num { font-size: 28px; }
  .results-root .hero-name { font-size: 22px; }
  .results-root .hero-sub { justify-content: center; gap: 6px 14px; }

  .results-root .percentile-card { grid-template-columns: 1fr; gap: 16px; padding: 20px; }
  .results-root .percentile-card.mode-b { grid-template-columns: 1fr; }
  .results-root .motivational-text { max-width: none; font-size: 13px; }
  .results-root .strength-card { padding: 22px 20px; }
  .results-root .strength-name { font-size: 22px; }
  .results-root .strength-pct { font-size: 16px; }
  .results-root .percentile-text { flex-direction: row; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .results-root .pct-prefix { margin-bottom: 0; font-size: 10px; }
  .results-root .percentile-text .big { font-size: 36px; }
  .results-root .percentile-text .label { margin-top: 0; }
  .results-root .level-badge { justify-self: start; }

  .results-root .subjects-grid { gap: 10px; }
  .results-root .subject-card { padding: 16px 18px; }
  .results-root .subject-score { font-size: 20px; }

  .results-root .deep-card { padding: 22px 18px; }
  .results-root .deep-title { font-size: 15px; }
  .results-root .topic-row { grid-template-columns: 1fr; gap: 8px; padding: 12px 0; }
  .results-root .topic-name { font-size: 13px; }
  .results-root .topic-bar-wrap { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; }

  .results-root .behavior-grid { gap: 8px; }
  .results-root .beh-card { padding: 14px 8px; }
  .results-root .beh-icon { font-size: 20px; margin-bottom: 6px; }
  .results-root .beh-label { font-size: 9px; letter-spacing: 0.5px; margin-bottom: 4px; }
  .results-root .beh-value { font-size: 14px; }
  .results-root .beh-note { font-size: 9px; }

  .results-root .reco-card { padding: 24px 22px; }
  .results-root .reco-title { font-size: 17px; }
  .results-root .reco-text { font-size: 13px; line-height: 1.7; }
  .results-root .cta-btn { width: 100%; padding: 15px 20px; }
}

@media (max-width: 380px) {
  .results-root { padding: 16px 12px; }
  .results-root .header { flex-direction: column; align-items: flex-start; gap: 14px; padding-bottom: 18px; }
  .results-root .hb-text { text-align: left; }
  .results-root .hero { padding: 24px 18px; }
  .results-root .hero-name { font-size: 20px; }
  .results-root .score-ring { width: 108px; height: 108px; }
  .results-root .score-num { font-size: 26px; }
  .results-root .percentile-card { padding: 18px 16px; }
  .results-root .percentile-text .big { font-size: 28px; }
  .results-root .subjects-grid { grid-template-columns: 1fr; }
  .results-root .subject-card { padding: 16px; }
  .results-root .behavior-grid { grid-template-columns: 1fr; gap: 8px; }
  .results-root .beh-card {
    display: grid; grid-template-columns: auto 1fr auto;
    align-items: center; text-align: left; gap: 14px; padding: 14px 16px;
  }
  .results-root .beh-icon { margin-bottom: 0; font-size: 22px; }
  .results-root .beh-label { margin-bottom: 2px; font-size: 10px; }
  .results-root .beh-value { font-size: 15px; text-align: right; }
  .results-root .beh-note { grid-column: 2 / -1; text-align: left; margin-top: 0; font-size: 10px; }
  .results-root .reco-card { padding: 22px 18px; }
  .results-root .reco-title { font-size: 16px; }
}
`
