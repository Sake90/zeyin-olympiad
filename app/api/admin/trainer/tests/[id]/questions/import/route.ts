import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'
import { validateQuestion, type NormalizedQuestion } from '@/lib/trainer-validate'

interface PathCtx { params: { id: string } }

// Map Excel header (any of EN/RU forms) to the canonical key.
function pickField(row: Record<string, unknown>, candidates: string[]): unknown {
  for (const c of candidates) {
    if (c in row && row[c] !== '' && row[c] != null) return row[c]
  }
  return ''
}

function parseRow(row: Record<string, unknown>): {
  question_text?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  correct_option?: string
  explanation?: string
} {
  return {
    question_text: String(pickField(row, ['question_text', 'Вопрос', 'question'])).trim(),
    option_a: String(pickField(row, ['option_a', 'Вариант A', 'Вариант А', 'A'])).trim(),
    option_b: String(pickField(row, ['option_b', 'Вариант B', 'Вариант В', 'B'])).trim(),
    option_c: String(pickField(row, ['option_c', 'Вариант C', 'Вариант С', 'C'])).trim(),
    option_d: String(pickField(row, ['option_d', 'Вариант D', 'D'])).trim(),
    correct_option: String(pickField(row, ['correct_option', 'Правильный ответ', 'correct'])).trim(),
    explanation: String(pickField(row, ['explanation', 'Объяснение'])).trim(),
  }
}

export async function POST(req: NextRequest, { params }: PathCtx) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fd = await req.formData()
  const file = fd.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }

  let rows: Record<string, unknown>[]
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать Excel' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: test, error: testErr } = await db
    .from('trainer_tests')
    .select('id')
    .eq('id', params.id)
    .single()
  if (testErr || !test) {
    return NextResponse.json({ error: 'Тест не найден' }, { status: 404 })
  }

  const validated: NormalizedQuestion[] = []
  const errors: string[] = []

  rows.forEach((row, i) => {
    const parsed = parseRow(row)
    // Skip completely empty trailing rows.
    if (
      !parsed.question_text &&
      !parsed.option_a && !parsed.option_b && !parsed.option_c && !parsed.option_d &&
      !parsed.correct_option && !parsed.explanation
    ) {
      return
    }
    const result = validateQuestion(parsed)
    if ('error' in result) {
      // +2 because: row index is 0-based and there's a header row above.
      errors.push(`строка ${i + 2}: ${result.error}`)
    } else {
      validated.push(result)
    }
  })

  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation', errors }, { status: 400 })
  }
  if (validated.length === 0) {
    return NextResponse.json({ error: 'В файле нет валидных строк' }, { status: 400 })
  }

  // Append after the current max order_index.
  const { data: maxRow } = await db
    .from('trainer_questions')
    .select('order_index')
    .eq('test_id', params.id)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const startOrder = (maxRow?.order_index ?? 0) + 1

  const records = validated.map((v, i) => ({
    test_id: params.id,
    order_index: startOrder + i,
    ...v,
  }))

  const { error: insertErr } = await db.from('trainer_questions').insert(records)
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ imported: records.length })
}
