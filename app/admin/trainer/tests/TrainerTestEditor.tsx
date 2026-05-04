'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/admin/Toast'
import QuestionEditorModal, { type QuestionFormData, type QuestionDraft } from './QuestionEditorModal'

type UnlockState = 'open_now' | 'scheduled' | 'manual_later'

interface TestMeta {
  title: string
  description: string
  order_index: string
  time_limit_minutes: string
  unlock_state: UnlockState
  unlock_at_local: string // datetime-local format (YYYY-MM-DDTHH:mm)
}

interface QuestionRow {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  explanation: string | null
  order_index: number
}

const emptyMeta: TestMeta = {
  title: '',
  description: '',
  order_index: '0',
  time_limit_minutes: '',
  unlock_state: 'manual_later',
  unlock_at_local: '',
}

const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'
const textareaCls = 'w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'

function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

interface Props {
  mode: 'new' | 'edit'
  testId?: string
}

export default function TrainerTestEditor({ mode, testId }: Props) {
  const { toast } = useToast()
  const router = useRouter()

  const [meta, setMeta] = useState<TestMeta>(emptyMeta)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)

  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(null)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadFromServer(id: string) {
    setLoading(true)
    const res = await fetch(`/api/admin/trainer/tests/${id}`)
    if (res.ok) {
      const data = await res.json()
      const t = data.test
      let unlock_state: UnlockState = 'manual_later'
      if (t.is_unlocked) unlock_state = 'open_now'
      else if (t.unlock_at) unlock_state = 'scheduled'
      setMeta({
        title: t.title ?? '',
        description: t.description ?? '',
        order_index: String(t.order_index ?? 0),
        time_limit_minutes: t.time_limit_minutes != null ? String(t.time_limit_minutes) : '',
        unlock_state,
        unlock_at_local: isoToLocalInput(t.unlock_at),
      })
      setQuestions((data.questions ?? []) as QuestionRow[])
    } else {
      toast.error('Не удалось загрузить тест')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (mode === 'edit' && testId) loadFromServer(testId)
  }, [mode, testId]) // eslint-disable-line react-hooks/exhaustive-deps

  function metaToBody() {
    const tl = meta.time_limit_minutes.trim()
    const unlock_at = meta.unlock_state === 'scheduled'
      ? localInputToIso(meta.unlock_at_local)
      : null
    return {
      title: meta.title.trim(),
      description: meta.description.trim() || null,
      order_index: Number(meta.order_index) || 0,
      time_limit_minutes: tl ? Number(tl) : null,
      is_unlocked: meta.unlock_state === 'open_now',
      unlock_at,
    }
  }

  async function saveMeta() {
    if (!meta.title.trim()) {
      toast.error('Введите название теста')
      return
    }
    if (meta.unlock_state === 'scheduled' && !meta.unlock_at_local) {
      toast.error('Укажите дату открытия')
      return
    }

    setSaving(true)
    const body = metaToBody()
    if (mode === 'new') {
      const res = await fetch('/api/admin/trainer/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setSaving(false)
      if (res.ok) {
        const data = await res.json()
        toast.success('Тест создан')
        router.push(`/admin/trainer/tests/${data.id}`)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Ошибка: ' + (err.error ?? 'не удалось создать'))
      }
    } else {
      const res = await fetch(`/api/admin/trainer/tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setSaving(false)
      if (res.ok) {
        toast.success('Сохранено')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Ошибка: ' + (err.error ?? 'не удалось сохранить'))
      }
    }
  }

  async function handleQuestionSave(form: QuestionFormData) {
    if (!testId) return
    if (editingQuestion) {
      const res = await fetch(`/api/admin/trainer/questions/${editingQuestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('Вопрос обновлён')
        setShowQuestionModal(false)
        setEditingQuestion(null)
        loadFromServer(testId)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Ошибка: ' + (err.error ?? 'не сохранилось'))
      }
    } else {
      const res = await fetch(`/api/admin/trainer/tests/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('Вопрос добавлен')
        setShowQuestionModal(false)
        setEditingQuestion(null)
        loadFromServer(testId)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error('Ошибка: ' + (err.error ?? 'не сохранилось'))
      }
    }
  }

  async function deleteQuestion(q: QuestionRow) {
    if (!confirm(`Удалить вопрос «${q.question_text.slice(0, 40)}...»?`)) return
    const res = await fetch(`/api/admin/trainer/questions/${q.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Вопрос удалён')
      if (testId) loadFromServer(testId)
    } else toast.error('Не удалось удалить')
  }

  async function moveQuestion(q: QuestionRow, direction: 'up' | 'down') {
    const res = await fetch(`/api/admin/trainer/questions/${q.id}/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    if (res.ok && testId) loadFromServer(testId)
    else toast.error('Не удалось переместить')
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !testId) return
    setImporting(true)
    setImportErrors([])
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/admin/trainer/tests/${testId}/questions/import`, {
      method: 'POST',
      body: fd,
    })
    setImporting(false)
    if (res.ok) {
      const data = await res.json()
      toast.success(`Импортировано: ${data.imported} вопросов`)
      loadFromServer(testId)
    } else {
      const data = await res.json().catch(() => ({}))
      if (data.error === 'validation' && Array.isArray(data.errors)) {
        setImportErrors(data.errors)
      } else {
        toast.error('Ошибка: ' + (data.error ?? 'импорт не удался'))
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleTemplate() {
    if (!testId) return
    window.open(`/api/admin/trainer/tests/${testId}/questions/template`, '_blank')
  }

  function openCreateQuestion() {
    setEditingQuestion(null)
    setShowQuestionModal(true)
  }
  function openEditQuestion(q: QuestionRow) {
    setEditingQuestion(q)
    setShowQuestionModal(true)
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400">
        Загрузка...
      </div>
    )
  }

  const editingDraft: QuestionDraft | null = editingQuestion
    ? {
        question_text: editingQuestion.question_text,
        option_a: editingQuestion.option_a,
        option_b: editingQuestion.option_b,
        option_c: editingQuestion.option_c,
        option_d: editingQuestion.option_d,
        correct_option: editingQuestion.correct_option,
        explanation: editingQuestion.explanation ?? '',
      }
    : null

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/trainer/tests"
            className="text-xs text-gray-400 hover:text-[#1ec8c8]"
          >
            ← К списку тестов
          </Link>
          <h1 className="mt-1 text-2xl font-black text-gray-800">
            {mode === 'new' ? 'Новый тест' : meta.title || 'Тест'}
          </h1>
        </div>
        {mode === 'edit' && testId && (
          <a
            href={`/admin/trainer/tests/${testId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:border-[#f47920] hover:text-[#f47920]"
          >
            👁 Превью
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
        {/* LEFT: meta form */}
        <form
          onSubmit={e => { e.preventDefault(); saveMeta() }}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-3 font-bold text-gray-800">Метаданные</h2>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Название *</label>
              <input
                type="text"
                value={meta.title}
                onChange={e => setMeta(p => ({ ...p, title: e.target.value }))}
                required
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-500">Описание</label>
              <textarea
                rows={3}
                value={meta.description}
                onChange={e => setMeta(p => ({ ...p, description: e.target.value }))}
                className={textareaCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Order index</label>
                <input
                  type="number"
                  value={meta.order_index}
                  onChange={e => setMeta(p => ({ ...p, order_index: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Лимит, мин</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Без таймера"
                  value={meta.time_limit_minutes}
                  onChange={e => setMeta(p => ({ ...p, time_limit_minutes: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs text-gray-500">Состояние</div>
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                {(
                  [
                    ['open_now',     'Открыт сразу'],
                    ['scheduled',    'Откроется в:'],
                    ['manual_later', 'Открою вручную позже'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      checked={meta.unlock_state === key}
                      onChange={() => setMeta(p => ({ ...p, unlock_state: key }))}
                      className="accent-[#1ec8c8]"
                    />
                    {label}
                    {key === 'scheduled' && meta.unlock_state === 'scheduled' && (
                      <input
                        type="datetime-local"
                        value={meta.unlock_at_local}
                        onChange={e => setMeta(p => ({ ...p, unlock_at_local: e.target.value }))}
                        className="ml-2 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-[#1ec8c8]"
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 block w-full rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
          >
            {saving ? 'Сохранение...' : mode === 'new' ? 'Создать' : 'Сохранить'}
          </button>
        </form>

        {/* RIGHT: questions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-gray-800">
              Вопросы <span className="font-mono text-sm text-gray-400">({questions.length})</span>
            </h2>
            {mode === 'edit' && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={handleTemplate}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]"
                >
                  ↓ Шаблон
                </button>
                <label
                  className={`cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1 text-xs ${importing ? 'text-gray-300' : 'text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]'}`}
                >
                  {importing ? 'Импорт...' : '↑ Excel'}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleImport}
                    disabled={importing}
                  />
                </label>
                <button
                  type="button"
                  onClick={openCreateQuestion}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
                >
                  + Вопрос
                </button>
              </div>
            )}
          </div>

          {importErrors.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <div className="mb-1 font-bold">Импорт отклонён, ошибки:</div>
              <ul className="list-disc pl-5">
                {importErrors.map((err, i) => (<li key={i}>{err}</li>))}
              </ul>
              <button
                type="button"
                onClick={() => setImportErrors([])}
                className="mt-2 text-[10px] uppercase text-red-500 hover:underline"
              >
                Закрыть
              </button>
            </div>
          )}

          {mode === 'new' ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
              Сначала сохрани тест, потом добавляй вопросы.
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {questions.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
                  Вопросов пока нет.
                </div>
              )}
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="flex flex-col items-center pt-1">
                    <span className="font-mono text-xs text-gray-400">{q.order_index}</span>
                    <button
                      onClick={() => moveQuestion(q, 'up')}
                      disabled={i === 0}
                      className="text-[10px] leading-none text-gray-300 hover:text-[#1ec8c8] disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveQuestion(q, 'down')}
                      disabled={i === questions.length - 1}
                      className="text-[10px] leading-none text-gray-300 hover:text-[#1ec8c8] disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-grow">
                    <div className="text-sm text-gray-800">
                      {q.question_text.length > 80
                        ? q.question_text.slice(0, 80) + '...'
                        : q.question_text}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-emerald-700">
                        Ответ: {q.correct_option}
                      </span>
                      {q.explanation && <span title="Есть объяснение">💡</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => openEditQuestion(q)}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => deleteQuestion(q)}
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-300 hover:border-red-300 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showQuestionModal && (
        <QuestionEditorModal
          initial={editingDraft}
          onCancel={() => { setShowQuestionModal(false); setEditingQuestion(null) }}
          onSave={handleQuestionSave}
        />
      )}
    </div>
  )
}
