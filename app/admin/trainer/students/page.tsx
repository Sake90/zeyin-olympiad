'use client'

import { useEffect, useRef, useState } from 'react'

interface TrainerStudent {
  id: string
  full_name: string
  class_label: string
  login: string
  created_at: string
}

interface ImportResult {
  imported: number
  skipped: number
  skipped_logins: string[]
}

export default function TrainerStudentsPage() {
  const [students, setStudents] = useState<TrainerStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [lastImport, setLastImport] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadStudents() {
    setLoading(true)
    const res = await fetch('/api/admin/trainer/students')
    if (res.ok) {
      const data = await res.json()
      setStudents(data.students ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadStudents() }, [])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setLastImport(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/trainer/students', { method: 'POST', body: fd })
    setImporting(false)
    if (res.ok) {
      const data: ImportResult = await res.json()
      setLastImport(data)
      loadStudents()
    } else {
      const err = await res.json().catch(() => ({}))
      alert('Ошибка: ' + (err.error ?? 'неизвестная'))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleTemplate() {
    window.open('/api/admin/trainer/students/template', '_blank')
  }

  async function handleDelete(id: string, fullName: string) {
    if (!confirm(`Удалить ученика "${fullName}"?`)) return
    const res = await fetch(`/api/admin/trainer/students?id=${id}`, { method: 'DELETE' })
    if (res.ok) loadStudents()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800">
            Тренажер · Ученики{' '}
            <span className="font-mono text-base text-gray-400">({students.length})</span>
          </h1>
          <p className="mt-1 text-xs text-gray-400">6 класс · отдельно от олимпиады</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTemplate}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]"
          >
            ↓ Шаблон Excel
          </button>
          <label
            className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-bold text-white transition-all ${
              importing ? 'opacity-60' : ''
            }`}
            style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
          >
            {importing ? 'Импорт...' : '↑ Импорт из Excel'}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
          </label>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
        <div className="font-bold text-gray-800">Формат файла</div>
        <div className="mt-1">
          Колонки: <code className="font-mono text-[#1ec8c8]">full_name</code>,{' '}
          <code className="font-mono text-[#1ec8c8]">class_label</code>,{' '}
          <code className="font-mono text-[#1ec8c8]">login</code>,{' '}
          <code className="font-mono text-[#1ec8c8]">password</code>.
        </div>
        <div className="mt-1 text-xs text-gray-400">
          Пароль в файле в открытом виде — при импорте хешируется (bcrypt). Дубликаты по логину пропускаются.
        </div>
      </div>

      {lastImport && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <div className="font-bold text-emerald-800">
            Импортировано: {lastImport.imported}
            {lastImport.skipped > 0 && `, пропущено дубликатов: ${lastImport.skipped}`}
          </div>
          {lastImport.skipped_logins.length > 0 && (
            <div className="mt-1 font-mono text-xs text-emerald-700">
              Пропущенные логины: {lastImport.skipped_logins.join(', ')}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['ФИО', 'Класс', 'Логин', 'Создан', ''].map(h => (
                <th key={h} className="px-4 py-3 font-mono text-xs font-bold text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{s.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{s.class_label}</td>
                <td className="px-4 py-3 font-mono text-[#1ec8c8]">{s.login}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(s.id, s.full_name)}
                    className="text-xs text-gray-300 hover:text-red-400"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  Нет учеников. Импортируйте Excel.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">Загрузка...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
