import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import { createServiceClient } from '@/lib/supabase'
import { getAdminSessionFromRequest } from '@/lib/auth'

interface TrainerImportRow {
  full_name: string
  class_label: string
  login: string
  password: string
}

function parseTrainerExcel(buffer: Buffer): TrainerImportRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  return rows
    .map(row => {
      const full_name = String(row['full_name'] ?? row['ФИО'] ?? '').trim()
      const class_label = String(row['class_label'] ?? row['Класс'] ?? '').trim()
      const login = String(row['login'] ?? row['Логин'] ?? '').trim().toLowerCase()
      const password = String(row['password'] ?? row['Пароль'] ?? '').trim()
      return { full_name, class_label, login, password }
    })
    .filter(r => r.full_name && r.login && r.password)
}

// ─── GET — list all trainer students ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createServiceClient()
  const { data, error } = await db
    .from('trainer_students')
    .select('id, full_name, class_label, login, created_at')
    .order('class_label', { ascending: true })
    .order('full_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ students: data ?? [] })
}

// ─── POST — import from Excel (multipart/form-data with `file`) ──────────────
export async function POST(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const fd = await req.formData()
  const file = fd.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let rows: TrainerImportRow[]
  try {
    rows = parseTrainerExcel(buffer)
  } catch {
    return NextResponse.json({ error: 'Не удалось прочитать Excel' }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'В файле нет валидных строк' }, { status: 400 })
  }

  const db = createServiceClient()

  // Find logins that already exist — skip those with notification.
  const incomingLogins = rows.map(r => r.login)
  const { data: existing, error: existingErr } = await db
    .from('trainer_students')
    .select('login')
    .in('login', incomingLogins)
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 })
  }
  const existingSet = new Set((existing ?? []).map(e => e.login))

  // Also dedupe inside the file itself (first occurrence wins).
  const seen = new Set<string>()
  const skippedDuplicates: string[] = []
  const toInsert: TrainerImportRow[] = []
  for (const row of rows) {
    if (existingSet.has(row.login) || seen.has(row.login)) {
      skippedDuplicates.push(row.login)
      continue
    }
    seen.add(row.login)
    toInsert.push(row)
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: skippedDuplicates.length,
      skipped_logins: skippedDuplicates,
    })
  }

  const records = await Promise.all(
    toInsert.map(async r => ({
      full_name: r.full_name,
      class_label: r.class_label,
      login: r.login,
      password_hash: await bcrypt.hash(r.password, 10),
    }))
  )

  const { error: insertErr } = await db.from('trainer_students').insert(records)
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    imported: records.length,
    skipped: skippedDuplicates.length,
    skipped_logins: skippedDuplicates,
  })
}

// ─── DELETE — remove a single student by id ──────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!(await getAdminSessionFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from('trainer_students').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
