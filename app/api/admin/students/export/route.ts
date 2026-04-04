import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'
import { exportStudentsExcel } from '@/lib/excel'

// GET /api/admin/students/export?olympiad_id=...
export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const olympiadId = req.nextUrl.searchParams.get('olympiad_id')

  const db = createServiceClient()
  let query = db
    .from('students')
    .select('full_name, school, grade, district, language, login, password_plain, whatsapp')
    .order('full_name')

  if (olympiadId) query = query.eq('olympiad_id', olympiadId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const buffer = exportStudentsExcel(data ?? [])
  const filename = `zeyin_students_${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
