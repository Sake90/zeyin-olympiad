import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'
import { generateUniqueLogin, generatePassword } from '@/lib/login-gen'
import { parseStudentsExcel, attachCredentials } from '@/lib/excel'

// GET /api/admin/students?olympiad_id=...&page=1&limit=50&search=...
export async function GET(req: NextRequest) {
  try {
    console.log('[GET /api/admin/students] ENV check:', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK' : 'MISSING',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'OK' : 'MISSING',
      jwtSecret: process.env.JWT_SECRET ? 'OK' : 'MISSING (using default)',
    })

    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const olympiadId = searchParams.get('olympiad_id')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))
    const search = searchParams.get('search') ?? ''
    const offset = (page - 1) * limit

    const db = createServiceClient()
    let query = db
      .from('students')
      .select('id, full_name, school, grade, district, language, login, password_plain, whatsapp, registered_at, olympiad_id', { count: 'exact' })
      .order('registered_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (olympiadId) query = query.eq('olympiad_id', olympiadId)
    if (search) query = query.ilike('full_name', `%${search}%`)

    const { data, count, error } = await query
    if (error) {
      console.error('[GET /api/admin/students] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ students: data, total: count ?? 0, page, limit })
  } catch (e) {
    console.error('[GET /api/admin/students] Unhandled exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/admin/students — add single student manually
export async function POST(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { full_name, school, grade, district, language, whatsapp, olympiad_id } = body

    if (!full_name) {
      return NextResponse.json({ error: 'full_name required' }, { status: 400 })
    }

    const db = createServiceClient()

    const { data: existing } = await db.from('students').select('login')
    const existingLogins = new Set((existing ?? []).map(s => s.login))
    const login = generateUniqueLogin(full_name, existingLogins)
    const password_plain = generatePassword()
    const password_hash = await bcrypt.hash(password_plain, 10)

    const { data, error } = await db
      .from('students')
      .insert({
        full_name: full_name.trim(),
        school: school?.trim() ?? null,
        grade: grade?.trim() ?? null,
        district: district?.trim() ?? null,
        language: language ?? 'ru',
        login,
        password_hash,
        password_plain,
        olympiad_id: olympiad_id ?? null,
        whatsapp: whatsapp?.replace(/\D/g, '') || null,
      })
      .select('id, full_name, login, password_plain, school, grade, language, whatsapp')
      .single()

    if (error) {
      console.error('[POST /api/admin/students] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('[POST /api/admin/students] Unhandled exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE /api/admin/students?id=...
export async function DELETE(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = createServiceClient()
    const { error } = await db.from('students').delete().eq('id', id)
    if (error) {
      console.error('[DELETE /api/admin/students] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/admin/students] Unhandled exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/admin/students — bulk import from Excel (multipart/form-data, field "file")
export async function PATCH(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const olympiadId = formData.get('olympiad_id') as string | null

    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const rows = parseStudentsExcel(buffer)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in file' }, { status: 400 })
    }

    const db = createServiceClient()

    const { data: existing } = await db.from('students').select('login')
    const existingLogins = new Set((existing ?? []).map(s => s.login))

    const withCreds = attachCredentials(rows)

    const toInsert: object[] = []
    for (const s of withCreds) {
      const login = generateUniqueLogin(s.full_name, existingLogins)
      existingLogins.add(login) // prevent in-batch duplicates
      toInsert.push({
        full_name: s.full_name,
        school: s.school || null,
        grade: s.grade || null,
        language: s.language,
        login,
        password_plain: s.password_plain,
        password_hash: await bcrypt.hash(s.password_plain, 10),
        olympiad_id: olympiadId || null,
        whatsapp: s.whatsapp.replace(/\D/g, '') || null,
      })
    }

    const { data, error } = await db
      .from('students')
      .insert(toInsert)
      .select('id, full_name, login, password_plain')

    if (error) {
      console.error('[PATCH /api/admin/students] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ imported: data?.length ?? 0, students: data })
  } catch (e) {
    console.error('[PATCH /api/admin/students] Unhandled exception:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
