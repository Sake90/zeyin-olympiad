import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAdminSessionFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sample = [
    { full_name: 'Иванов Иван Иванович',  class_label: '6А', login: 'ivanov6a',  password: 'pass1234' },
    { full_name: 'Петрова Анна Сергеевна', class_label: '6Б', login: 'petrova6b', password: 'qwerty99' },
  ]

  const ws = XLSX.utils.json_to_sheet(sample, {
    header: ['full_name', 'class_label', 'login', 'password'],
  })
  ws['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 16 }, { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Trainer Students')
  const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="trainer_students_template.xlsx"',
    },
  })
}
