// Question payload validation shared between the manual editor and the
// Excel importer. Returns either a normalized record or an error string.

export type Option = 'A' | 'B' | 'C' | 'D'

export interface NormalizedQuestion {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: Option
  explanation: string | null
}

export interface QuestionInput {
  question_text?: unknown
  option_a?: unknown
  option_b?: unknown
  option_c?: unknown
  option_d?: unknown
  correct_option?: unknown
  explanation?: unknown
}

export function validateQuestion(input: QuestionInput): NormalizedQuestion | { error: string } {
  const question_text = typeof input.question_text === 'string' ? input.question_text.trim() : ''
  if (!question_text) return { error: 'пустой текст вопроса' }

  const fields: Array<['option_a' | 'option_b' | 'option_c' | 'option_d', string]> = [
    ['option_a', 'A'],
    ['option_b', 'B'],
    ['option_c', 'C'],
    ['option_d', 'D'],
  ]
  const opts: Record<'option_a' | 'option_b' | 'option_c' | 'option_d', string> = {
    option_a: '', option_b: '', option_c: '', option_d: '',
  }
  for (const [key, label] of fields) {
    const v = typeof input[key] === 'string' ? (input[key] as string).trim() : ''
    if (!v) return { error: `пустой вариант ${label}` }
    opts[key] = v
  }

  const co = typeof input.correct_option === 'string'
    ? input.correct_option.trim().toUpperCase()
    : ''
  if (co !== 'A' && co !== 'B' && co !== 'C' && co !== 'D') {
    return { error: 'правильный ответ должен быть A/B/C/D' }
  }

  const explanationRaw = typeof input.explanation === 'string' ? input.explanation.trim() : ''
  const explanation = explanationRaw ? explanationRaw : null

  return {
    question_text,
    option_a: opts.option_a,
    option_b: opts.option_b,
    option_c: opts.option_c,
    option_d: opts.option_d,
    correct_option: co as Option,
    explanation,
  }
}
