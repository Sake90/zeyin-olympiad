import Anthropic from '@anthropic-ai/sdk'
import { ANALYSIS_MAX_TOKENS, ANALYSIS_MODEL } from './analysis-config'
import { buildAnalysisPrompt, type AnalysisInput } from './analysis-prompt'

export type AnalysisSource = 'claude' | 'fallback'

export interface AnalysisResult {
  observations: [string, string, string]
  source: AnalysisSource
  generated_at: string
}

// Forbidden words — exact-substring match, case-insensitive. Kept short on
// purpose: false-positives here would force a fallback on otherwise-good copy.
const FORBIDDEN_WORDS_RU = [
  'плохо', 'слабый', 'слаб', 'неудачно', 'провал', 'ужасно',
  'глупо', 'тупо', 'дурак', 'отстающий', 'двоечник', 'неуч', 'безнадёжно',
]
const FORBIDDEN_WORDS_KK = [
  'нашар', 'әлсіз', 'жаман', 'ақымақ', 'түсінбейді', 'үміт жоқ',
]

const URL_RE = /https?:\/\//i
const EMAIL_RE = /\S+@\S+/
const SCHOOL_TUTOR_RE = /\b(школ\w*|мектеп\w*|репетитор\w*|курс\w*|преподавател\w*|учител\w*)\b/i

const MIN_CHARS = 30
const MAX_CHARS = 200

// ─────────────────────────────────────────────────────────────────────────────
// Public API

export async function generateAnalysis(
  input: AnalysisInput,
  lang: 'ru' | 'kk',
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[analysis] ANTHROPIC_API_KEY missing — using fallback')
    return buildFallbackAnalysis(input, lang)
  }

  const client = new Anthropic({ apiKey })
  const prompt = buildAnalysisPrompt(input, lang)

  let raw: string
  try {
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: ANALYSIS_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') {
      console.error('[analysis] no text block in response — using fallback')
      return buildFallbackAnalysis(input, lang)
    }
    raw = block.text.trim()
  } catch (e) {
    console.error('[analysis] Claude API call failed:', e)
    return buildFallbackAnalysis(input, lang)
  }

  // Strip a stray ```json fence if the model emitted one despite the prompt.
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    console.error('[analysis] JSON parse failed — using fallback. Raw:', raw.slice(0, 200))
    return buildFallbackAnalysis(input, lang)
  }

  const observations = extractObservations(parsed)
  if (!observations) {
    console.error('[analysis] missing observation_1/2/3 — using fallback')
    return buildFallbackAnalysis(input, lang)
  }

  if (!validateObservations(observations, lang)) {
    console.error('[analysis] validation failed — using fallback')
    return buildFallbackAnalysis(input, lang)
  }

  return {
    observations,
    source: 'claude',
    generated_at: new Date().toISOString(),
  }
}

// Last line of defense — must always produce something readable from the data.
export function buildFallbackAnalysis(
  input: AnalysisInput,
  lang: 'ru' | 'kk',
): AnalysisResult {
  return {
    observations: pickFallbackObservations(input, lang),
    source: 'fallback',
    generated_at: new Date().toISOString(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation

function extractObservations(parsed: unknown): [string, string, string] | null {
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  const o1 = obj.observation_1
  const o2 = obj.observation_2
  const o3 = obj.observation_3
  if (typeof o1 !== 'string' || typeof o2 !== 'string' || typeof o3 !== 'string') return null
  return [o1.trim(), o2.trim(), o3.trim()]
}

function validateObservations(obs: [string, string, string], lang: 'ru' | 'kk'): boolean {
  const stopList = lang === 'kk' ? FORBIDDEN_WORDS_KK : FORBIDDEN_WORDS_RU
  for (const o of obs) {
    if (o.length < MIN_CHARS || o.length > MAX_CHARS) return false
    if (URL_RE.test(o)) return false
    if (EMAIL_RE.test(o)) return false
    if (SCHOOL_TUTOR_RE.test(o)) return false
    const lower = o.toLowerCase()
    for (const w of stopList) {
      if (lower.includes(w)) return false
    }
  }
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback templates — driven entirely by the input data, no model call.

function pickFallbackObservations(input: AnalysisInput, lang: 'ru' | 'kk'): [string, string, string] {
  const strongest = pickStrongest(input)
  const weakest = pickWeakest(input)
  const closing = pickClosing(input.accuracy_percent, lang)

  if (lang === 'kk') {
    const o1 = strongest
      ? `Оқушы "${strongest.name}" бойынша жақсы нәтиже көрсетті — ${Math.round(strongest.percent)}%.`
      : `Оқушы олимпиадаға қатысып, тырысып шықты — бұл өсу үшін маңызды қадам.`
    const o2 = weakest
      ? `"${weakest.name}" тақырыбы бойынша қосымша жаттығу — келесі бағыт (${Math.round(weakest.percent)}%).`
      : `Жалпы нәтижені жақсарту үшін олимпиада тақырыптарын қайта қарап шығу пайдалы болады.`
    return [o1, o2, closing]
  }

  const o1 = strongest
    ? `Ученик показал хороший результат в теме "${strongest.name}" — ${Math.round(strongest.percent)}%.`
    : `Ученик дошёл до конца олимпиады — это уже важный шаг для роста.`
  const o2 = weakest
    ? `Тема "${weakest.name}" — следующая зона для практики (${Math.round(weakest.percent)}%).`
    : `Повторение тем олимпиады поможет закрепить материал и поднять общий результат.`
  return [o1, o2, closing]
}

interface NamedPercent { name: string; percent: number }

function pickStrongest(input: AnalysisInput): NamedPercent | null {
  const candidates: NamedPercent[] = []
  for (const t of input.math_topics) candidates.push({ name: t.name, percent: t.percent })
  for (const s of input.subject_scores) {
    if (s.total > 0) candidates.push({ name: s.name, percent: (s.score / s.total) * 100 })
  }
  if (candidates.length === 0) return null
  return candidates.reduce((best, c) => (c.percent > best.percent ? c : best))
}

// Strongest can hit 100%; weakest should ignore 100% so we don't accidentally
// flag a perfect topic as "needs work". Falls back to absolute min if all 100.
function pickWeakest(input: AnalysisInput): NamedPercent | null {
  const candidates: NamedPercent[] = []
  for (const t of input.math_topics) candidates.push({ name: t.name, percent: t.percent })
  for (const s of input.subject_scores) {
    if (s.total > 0) candidates.push({ name: s.name, percent: (s.score / s.total) * 100 })
  }
  if (candidates.length === 0) return null
  const nonPerfect = candidates.filter(c => c.percent < 100)
  const pool = nonPerfect.length > 0 ? nonPerfect : candidates
  return pool.reduce((worst, c) => (c.percent < worst.percent ? c : worst))
}

function pickClosing(accuracy: number, lang: 'ru' | 'kk'): string {
  if (lang === 'kk') {
    if (accuracy >= 80) return 'Осылай жалғастыр! Келесі қадам — сүйікті пәніңді тереңірек меңгеру.'
    if (accuracy >= 60) return 'Жақсы нәтиже. Жаттығуды жалғастырсаң, одан да жақсы болады.'
    if (accuracy >= 30) return 'Әр әрекет күштірек етеді. Ең бастысы — алға қарай жалғастыру.'
    return 'Ең бастысы — тырысып көру. Әрі қарай жеңіл болады.'
  }
  if (accuracy >= 80) return 'Так держать! Следующий шаг — углубление в любимом предмете.'
  if (accuracy >= 60) return 'Хороший результат. Продолжая практику, будет ещё лучше.'
  if (accuracy >= 30) return 'Каждая попытка делает сильнее. Главное — продолжать.'
  return 'Главное — что попробовал. Дальше будет легче.'
}
