import type { AnalysisInput } from './analysis-prompt'

// Deterministic, non-LLM. The AI observations block already gives the parent
// the "what / why" — recommendations are the "what to do next", and we
// generate them from rules so they can never hallucinate or churn.
//
// Rules fire in priority order; we collect matches, dedupe by title, and pad
// with defaults until we have exactly 3.

export type RecommendationIcon =
  | 'target'    // weakest topic — hit the bullseye
  | 'clock'    // pacing / weak_end / weak_start — time management
  | 'shield'   // fast + low confidence — slow down, defend against silly mistakes
  | 'trophy'   // top scorer — next stage prep
  | 'book'    // weak subject — study
  | 'lightbulb' // generic improvements

export interface Recommendation {
  icon: RecommendationIcon
  title_ru: string
  title_kk: string
  text_ru: string
  text_kk: string
}

// Names that indicate a math subject in subject_scores — matched via lowercase
// substring, so "Математика", "математика", "Math", "Matematika" all hit.
const MATH_NAME_TOKENS = ['матем', 'math']

function isMathSubject(name: string): boolean {
  const lower = name.toLowerCase()
  return MATH_NAME_TOKENS.some(t => lower.includes(t))
}

interface NamedPercent { name: string; percent: number }

function weakestTopic(input: AnalysisInput): NamedPercent | null {
  const candidates = input.math_topics.filter(t => t.percent < 50)
  if (candidates.length === 0) return null
  return candidates.reduce((m, c) => (c.percent < m.percent ? c : m))
}

function weakestNonMathSubject(input: AnalysisInput): NamedPercent | null {
  const candidates = input.subject_scores
    .filter(s => s.total > 0 && !isMathSubject(s.name))
    .map(s => ({ name: s.name, percent: (s.score / s.total) * 100 }))
    .filter(s => s.percent < 50)
  if (candidates.length === 0) return null
  return candidates.reduce((m, c) => (c.percent < m.percent ? c : m))
}

const DEFAULTS: Recommendation[] = [
  {
    icon: 'lightbulb',
    title_ru: 'Регулярная практика',
    title_kk: 'Тұрақты жаттығу',
    text_ru: '20 минут в день эффективнее чем 3 часа раз в неделю.',
    text_kk: 'Күніне 20 минут жаттығу — аптасына 3 сағаттан тиімдірек.',
  },
  {
    icon: 'book',
    title_ru: 'Видеоразборы заданий',
    title_kk: 'Тапсырмалардың бейнеталдауы',
    text_ru: 'Просмотр разбора похожих задач закрепляет понимание.',
    text_kk: 'Ұқсас тапсырмалардың талдауын көру түсінікті бекітеді.',
  },
  {
    icon: 'shield',
    title_ru: 'Не бояться ошибок',
    title_kk: 'Қателіктерден қорықпау',
    text_ru: 'Каждая ошибка — это материал для роста.',
    text_kk: 'Әрбір қателік — өсу үшін материал.',
  },
]

export function buildRecommendations(input: AnalysisInput): Recommendation[] {
  const out: Recommendation[] = []
  const seenTitles = new Set<string>()

  function push(rec: Recommendation) {
    if (out.length >= 3) return
    if (seenTitles.has(rec.title_ru)) return
    seenTitles.add(rec.title_ru)
    out.push(rec)
  }

  // Rule 1 — weakest math topic. Personal advice for the parent, so naming
  // the topic here is OK (unlike the public Claude observation block).
  const wt = weakestTopic(input)
  if (wt) {
    push({
      icon: 'target',
      title_ru: `Закрепить тему «${wt.name}»`,
      title_kk: `«${wt.name}» тақырыбын бекіту`,
      text_ru: 'Это направление сейчас самое слабое — фокус на нём за 1-2 недели даст заметный рост.',
      text_kk: 'Бұл бағыт қазір ең әлсіз — оған 1-2 апта көңіл бөлсе, нәтиже едәуір өседі.',
    })
  }

  // Rule 2 — fast + low confidence (tapping pattern).
  if (input.behavior?.speed_label === 'fast' && input.behavior.confidence_label === 'low') {
    push({
      icon: 'shield',
      title_ru: 'Не торопись с ответами',
      title_kk: 'Жауап берерде асықпа',
      text_ru: 'Чтение вопроса 2 раза перед выбором ответа поможет избежать обидных ошибок.',
      text_kk: 'Жауап таңдамас бұрын сұрақты 2 рет оқу қателіктерден сақтайды.',
    })
  }

  // Rule 3 — fading attention towards the end.
  if (input.behavior?.error_pattern === 'weak_end') {
    push({
      icon: 'clock',
      title_ru: 'Беречь силы к концу',
      title_kk: 'Соңына дейін күш сақтау',
      text_ru: 'К последним вопросам внимание ослабевает. Короткая пауза в середине помогает.',
      text_kk: 'Соңғы сұрақтарға назар әлсірейді. Ортасында қысқа үзіліс жасау көмектеседі.',
    })
  }

  // Rule 4 — slow start.
  if (input.behavior?.error_pattern === 'weak_start') {
    push({
      icon: 'clock',
      title_ru: 'Разминка перед стартом',
      title_kk: 'Старттан алдын дайындық',
      text_ru: 'Несколько простых задач перед олимпиадой помогают войти в ритм.',
      text_kk: 'Олимпиада алдында бірнеше оңай тапсырма ырғаққа кіруге көмектеседі.',
    })
  }

  // Rule 5 — weak non-math subject.
  const ws = weakestNonMathSubject(input)
  if (ws) {
    push({
      icon: 'book',
      title_ru: `Подтянуть ${ws.name}`,
      title_kk: `${ws.name} нығайту`,
      text_ru: 'По этому предмету заметный потенциал для роста.',
      text_kk: 'Бұл пән бойынша өсу мүмкіндігі үлкен.',
    })
  }

  // Rule 6 — top scorer prep for the in-person 2nd round.
  if (input.accuracy_percent >= 90) {
    push({
      icon: 'trophy',
      title_ru: 'Готовиться к 2-му туру 10 мая',
      title_kk: '10 мамырдағы 2-турға дайындалу',
      text_ru: 'Очный тур потребует ещё большей концентрации — формат отличается.',
      text_kk: 'Оффлайн турда одан да жоғары шоғырлану керек — формат басқаша.',
    })
  }

  // Pad with defaults if fewer than 3 rules matched.
  for (const d of DEFAULTS) {
    if (out.length >= 3) break
    push(d)
  }

  return out.slice(0, 3)
}
