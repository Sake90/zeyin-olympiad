import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth'
import * as XLSX from 'xlsx'

const HEADERS = [
  '№', 'Тип (тест/видео)', 'Вопрос каз', 'Вопрос рус',
  'Вариант A каз', 'Вариант A рус',
  'Вариант B каз', 'Вариант B рус',
  'Вариант C каз', 'Вариант C рус',
  'Вариант D каз', 'Вариант D рус',
  'Правильный ответ (A/B/C/D)',
  'YouTube ссылка каз', 'YouTube ссылка рус',
  'Предмет',
]

const SAMPLE = [
  1, 'тест', 'Сұрақ мәтіні', 'Текст вопроса',
  'Жауап A каз', 'Ответ A рус',
  'Жауап B каз', 'Ответ B рус',
  'Жауап C каз', 'Ответ C рус',
  'Жауап D каз', 'Ответ D рус',
  'A',
  '', '',
  'Математика',
]

export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, SAMPLE])

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 28 }, { wch: 28 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 22 }, { wch: 30 }, { wch: 30 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Вопросы')
  const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="questions_template.xlsx"',
    },
  })
}
