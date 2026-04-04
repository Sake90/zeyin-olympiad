import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'
import * as XLSX from 'xlsx'

function parseType(raw: string): 'test' | 'video' | 'task' {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'видео' || v === 'video') return 'video'
  if (v === 'задача' || v === 'task') return 'task'
  return 'test'
}

function parseCorrect(raw: string): string {
  return String(raw ?? 'a').trim().toLowerCase().charAt(0) || 'a'
}

function str(v: unknown): string {
  return String(v ?? '').trim()
}

// POST /api/admin/questions/import  (multipart: file, olympiad_id)
export async function POST(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const olympiadId = formData.get('olympiad_id') as string | null

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (!olympiadId) return NextResponse.json({ error: 'olympiad_id required' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Файл пустой или не содержит данных' }, { status: 400 })
  }

  // Get current max order_num to append after existing questions
  const db = createServiceClient()
  const { data: existing } = await db
    .from('questions')
    .select('order_num')
    .eq('olympiad_id', olympiadId)
    .order('order_num', { ascending: false })
    .limit(1)
  const baseOrder = (existing?.[0]?.order_num ?? 0) as number

  const toInsert = rows
    .filter(row => str(row['Вопрос рус']) || str(row['Вопрос каз']))
    .map((row, i) => ({
      olympiad_id: olympiadId,
      type: parseType(str(row['Тип (тест/видео)'])),
      order_num: Number(row['№']) || baseOrder + i + 1,
      question_ru: str(row['Вопрос рус']),
      question_kz: str(row['Вопрос каз']),
      option_a_ru: str(row['Вариант A рус']),
      option_a_kz: str(row['Вариант A каз']),
      option_b_ru: str(row['Вариант B рус']),
      option_b_kz: str(row['Вариант B каз']),
      option_c_ru: str(row['Вариант C рус']),
      option_c_kz: str(row['Вариант C каз']),
      option_d_ru: str(row['Вариант D рус']),
      option_d_kz: str(row['Вариант D каз']),
      correct_option: parseCorrect(str(row['Правильный ответ (A/B/C/D)'])),
      youtube_url_kz: str(row['YouTube ссылка каз']) || null,
      youtube_url_ru: str(row['YouTube ссылка рус']) || null,
    }))

  if (toInsert.length === 0) {
    return NextResponse.json({ error: 'Нет строк с заполненными вопросами' }, { status: 400 })
  }

  const { data, error } = await db.from('questions').insert(toInsert).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ imported: data?.length ?? 0 })
}
