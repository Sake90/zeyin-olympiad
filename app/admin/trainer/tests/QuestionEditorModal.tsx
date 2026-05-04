'use client'

import { useState } from 'react'

export type Option = 'A' | 'B' | 'C' | 'D'

export interface QuestionFormData {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: Option
  explanation: string | null
}

export interface QuestionDraft {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: Option
  explanation: string
}

interface Props {
  initial: QuestionDraft | null
  onCancel: () => void
  onSave: (form: QuestionFormData) => void | Promise<void>
}

const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'
const textareaCls = 'w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'

export default function QuestionEditorModal({ initial, onCancel, onSave }: Props) {
  const [form, setForm] = useState<QuestionDraft>(
    initial ?? {
      question_text: '',
      option_a: '', option_b: '', option_c: '', option_d: '',
      correct_option: 'A',
      explanation: '',
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) {
    setForm(p => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.question_text.trim()) return setError('Введите текст вопроса')
    if (!form.option_a.trim() || !form.option_b.trim() ||
        !form.option_c.trim() || !form.option_d.trim()) {
      return setError('Все 4 варианта должны быть заполнены')
    }
    setSaving(true)
    try {
      await onSave({
        question_text: form.question_text.trim(),
        option_a: form.option_a.trim(),
        option_b: form.option_b.trim(),
        option_c: form.option_c.trim(),
        option_d: form.option_d.trim(),
        correct_option: form.correct_option,
        explanation: form.explanation.trim() || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={() => !saving && onCancel()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="my-8 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 font-bold text-gray-800">
          {initial ? 'Редактировать вопрос' : 'Новый вопрос'}
        </h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Текст вопроса *</label>
            <textarea
              rows={3}
              value={form.question_text}
              onChange={e => set('question_text', e.target.value)}
              className={textareaCls}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(['A', 'B', 'C', 'D'] as const).map(letter => {
              const key = `option_${letter.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'
              return (
                <div key={letter}>
                  <label className="mb-1 block text-xs text-gray-500">Вариант {letter} *</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
              )
            })}
          </div>

          <div>
            <div className="mb-2 text-xs text-gray-500">Правильный ответ *</div>
            <div className="flex gap-2">
              {(['A', 'B', 'C', 'D'] as const).map(letter => {
                const active = form.correct_option === letter
                return (
                  <label
                    key={letter}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all ${
                      active
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="correct"
                      checked={active}
                      onChange={() => set('correct_option', letter)}
                      className="hidden"
                    />
                    {letter}
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Объяснение</label>
            <textarea
              rows={3}
              placeholder="Покажется ученику на разборе если он ошибся. Можно оставить пустым."
              value={form.explanation}
              onChange={e => set('explanation', e.target.value)}
              className={textareaCls}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-600 disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }}
          >
            {saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
