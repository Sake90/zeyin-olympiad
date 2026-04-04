import * as XLSX from 'xlsx'
import { generateUniqueLogin, generatePassword } from './login-gen'

export interface StudentImportRow {
  full_name: string
  school: string
  grade: string
  language: 'kz' | 'ru'
  whatsapp: string
}

export interface StudentWithCredentials extends StudentImportRow {
  login: string
  password_plain: string
}

/**
 * Parse an Excel/CSV buffer into student rows.
 * Expected columns (order doesn't matter, header row required):
 *   ФИО | Школа | Класс | Язык | WhatsApp
 */
export function parseStudentsExcel(buffer: Buffer): StudentImportRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })

  return rows
    .filter(row => row['ФИО'] || row['full_name'] || row['Имя'])
    .map(row => {
      const full_name = (row['ФИО'] || row['full_name'] || row['Имя'] || '').trim()
      const school = (row['Школа'] || row['school'] || '').trim()
      const grade = (row['Класс'] || row['grade'] || '').trim()
      const langRaw = (row['Язык'] || row['language'] || 'ru').trim().toLowerCase()
      const language: 'kz' | 'ru' = langRaw === 'kz' || langRaw === 'қаз' ? 'kz' : 'ru'
      const whatsapp = (row['WhatsApp'] || row['whatsapp'] || row['Телефон'] || '').trim()
      return { full_name, school, grade, language, whatsapp }
    })
    .filter(r => r.full_name.length > 0)
}

/**
 * Attach generated login/password to each student row.
 */
export function attachCredentials(
  students: StudentImportRow[]
): StudentWithCredentials[] {
  const usedLogins = new Set<string>()
  return students.map(s => {
    const login = generateUniqueLogin(s.full_name, usedLogins)
    usedLogins.add(login)
    return { ...s, login, password_plain: generatePassword() }
  })
}

/**
 * Generate an Excel buffer for export — includes login and password columns.
 */
export function exportStudentsExcel(
  students: Array<{
    full_name: string
    school: string | null
    grade: string | null
    district: string | null
    language: string
    login: string
    password_plain: string
    whatsapp: string | null
  }>
): Buffer {
  const data = students.map(s => ({
    ФИО: s.full_name,
    Район: s.district ?? '',
    Школа: s.school ?? '',
    Класс: s.grade ?? '',
    Язык: s.language,
    Логин: s.login,
    Пароль: s.password_plain,
    WhatsApp: s.whatsapp ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ученики')

  // Column widths
  ws['!cols'] = [
    { wch: 30 }, { wch: 22 }, { wch: 20 }, { wch: 8 },
    { wch: 6 }, { wch: 16 }, { wch: 10 }, { wch: 16 },
  ]

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
