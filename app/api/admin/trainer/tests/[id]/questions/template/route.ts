import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sample = [
    {
      question_text: '1/2 + 1/4 = ?',
      option_a: '3/4', option_b: '2/6', option_c: '1/6', option_d: '1/8',
      correct_option: 'A',
      explanation: 'Приводим к общему знаменателю 4: 2/4 + 1/4 = 3/4',
    },
    {
      question_text: '2/3 − 1/3 = ?',
      option_a: '1/3', option_b: '0', option_c: '2/6', option_d: '3/3',
      correct_option: 'A',
      explanation: '',
    },
    {
      question_text: 'Сократи 4/8',
      option_a: '1/2', option_b: '2/4', option_c: '4/8', option_d: '1/4',
      correct_option: 'A',
      explanation: 'Делим числитель и знаменатель на 4',
    },
  ]

  const ws = XLSX.utils.json_to_sheet(sample, {
    header: ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation'],
  })
  ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Trainer Questions')
  const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="trainer_questions_template.xlsx"',
    },
  })
}
