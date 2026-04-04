import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const olympiadId = req.nextUrl.searchParams.get('olympiad_id')
  if (!olympiadId) return NextResponse.json({ error: 'olympiad_id required' }, { status: 400 })

  const db = createServiceClient()
  const [{ data, error }, { data: olympiad }] = await Promise.all([
    db.from('results')
      .select('score, total_questions, cert_type, passed_to_round2, completed_at, subject_scores, students(full_name, school, grade, district, language)')
      .eq('olympiad_id', olympiadId)
      .order('score', { ascending: false }),
    db.from('olympiads').select('subjects').eq('id', olympiadId).single(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type SubjectDef = { name_ru: string; name_kz: string; from_q: number; to_q: number }
  const subjects: SubjectDef[] = olympiad?.subjects ?? []

  const rows = (data ?? []).map((r: any, i: number) => {
    const subMap = new Map<string, { score: number; total: number }>(
      (r.subject_scores ?? []).map((s: any) => [s.name_ru, s])
    )
    const base: Record<string, unknown> = {
      '№': i + 1,
      'ФИО': r.students?.full_name ?? '',
      'Класс': r.students?.grade ?? '',
      'Район': r.students?.district ?? '',
      'Язык': r.students?.language === 'kz' ? 'Қазақша' : 'Русский',
      'Школа': r.students?.school ?? '',
    }
    for (const s of subjects) {
      const ss = subMap.get(s.name_ru)
      base[s.name_ru] = ss ? `${ss.score}/${ss.total}` : '—'
    }
    base['Итого'] = `${r.score}/${r.total_questions}`
    base['%'] = r.total_questions > 0 ? Math.round((r.score / r.total_questions) * 100) : 0
    base['Уровень'] = r.cert_type === 'winner' ? 'Победитель' : r.cert_type === 'prize' ? 'Призёр' : 'Участник'
    base['2 тур'] = r.passed_to_round2 ? 'Да' : 'Нет'
    base['Завершено'] = new Date(r.completed_at).toLocaleString('ru')
    return base
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const baseColWidths = [{ wch: 4 }, { wch: 30 }, { wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 20 }]
  const subjectColWidths = subjects.map(() => ({ wch: 14 }))
  ws['!cols'] = [...baseColWidths, ...subjectColWidths, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 18 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Результаты')
  const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="zeyin_results_${olympiadId.slice(0, 8)}.xlsx"`,
    },
  })
}
