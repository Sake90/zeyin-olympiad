'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/admin/Toast'
import { VideoUploader } from '@/components/admin/VideoUploader'
import type { Topic, Explanation, LessonQuestion, ExplanationStyle } from '@/lib/supabase'

const INPUT_CLS = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'
const TEXTAREA_CLS = INPUT_CLS + ' resize-y min-h-[140px]'
const BTN_PRIMARY_CLS = 'rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50'
const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }
const BTN_SECONDARY_CLS = 'rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300'

type ExplanationState = Omit<Explanation, 'id' | 'topic_id'> & { id?: string }
type QuestionState = Omit<LessonQuestion, 'id' | 'topic_id'> & { id?: string; _temp?: string }

export default function TopicEditorPage({
  params,
}: {
  params: { courseId: string; topicId: string }
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [topic, setTopic] = useState<Topic | null>(null)
  const [styles, setStyles] = useState<ExplanationStyle[]>([])
  const [explByStyle, setExplByStyle] = useState<Record<string, ExplanationState>>({})
  const [questions, setQuestions] = useState<QuestionState[]>([])

  useEffect(() => { load() }, [params.topicId])
  async function load() {
    setLoading(true)
    const r = await fetch(`/api/admin/topics/${params.topicId}`)
    if (!r.ok) { toast.error('Не удалось загрузить'); setLoading(false); return }
    const d = await r.json() as {
      topic: Topic
      explanations: Explanation[]
      questions: LessonQuestion[]
      styles: ExplanationStyle[]
    }

    setTopic(d.topic)
    setStyles(d.styles)

    const map: Record<string, ExplanationState> = {}
    for (const s of d.styles) {
      const existing = d.explanations.find(e => e.style_code === s.code)
      map[s.code] = existing ?? {
        style_code: s.code,
        title_ru: '',
        title_kz: '',
        content_ru: '',
        content_kz: '',
        image_url: '',
        video_id: null,
      }
    }
    setExplByStyle(map)
    setQuestions(d.questions.map(q => ({ ...q })))
    setLoading(false)
  }

  function updateTopic<K extends keyof Topic>(key: K, value: Topic[K]) {
    setTopic(t => t ? { ...t, [key]: value } : t)
  }

  function updateExpl(code: string, patch: Partial<ExplanationState>) {
    setExplByStyle(m => ({ ...m, [code]: { ...m[code], ...patch } }))
  }

  function addQuestion() {
    const nextOrder = questions.reduce((m, q) => Math.max(m, q.order_num), 0) + 1
    setQuestions(qs => [...qs, {
      _temp: `tmp-${Date.now()}-${Math.random()}`,
      question_ru: '', question_kz: '',
      option_a_ru: '', option_b_ru: '', option_c_ru: '', option_d_ru: '',
      option_a_kz: '', option_b_kz: '', option_c_kz: '', option_d_kz: '',
      correct_option: 'A' as const,
      order_num: nextOrder,
    }])
  }

  function updateQuestion(idx: number, patch: Partial<QuestionState>) {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }

  function removeQuestion(idx: number) {
    if (!confirm('Удалить вопрос?')) return
    setQuestions(qs => qs.filter((_, i) => i !== idx))
  }

  async function saveAll() {
    if (!topic) return
    if (!topic.title_ru.trim()) { toast.error('Название темы (RU) обязательно'); return }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_ru.trim()) { toast.error(`Вопрос ${i + 1}: текст обязателен`); return }
      if (!(['A', 'B', 'C', 'D'] as string[]).includes(q.correct_option)) {
        toast.error(`Вопрос ${i + 1}: выберите правильный ответ`); return
      }
    }

    type SavedExpl = {
      style_code: string
      title_ru: string | null; title_kz: string | null
      content_ru: string | null; content_kz: string | null
      image_url: string | null
      video_id: string | null
    }
    let validated: SavedExpl[]
    try {
      validated = Object.values(explByStyle).filter(e => {
        const anyFilled = [e.title_ru, e.title_kz, e.content_ru, e.content_kz, e.image_url]
          .some(v => v && v.trim())
        const hasVideo = !!e.video_id
        if (!anyFilled && !hasVideo) return false
        if (!e.title_ru || !e.title_ru.trim()) {
          throw new Error(`Стиль «${e.style_code}»: title_ru обязателен, если поля заполнены`)
        }
        return true
      }).map(e => ({
        style_code: e.style_code,
        title_ru: e.title_ru, title_kz: e.title_kz,
        content_ru: e.content_ru, content_kz: e.content_kz,
        image_url: e.image_url,
        video_id: e.video_id ?? null,
      }))
    } catch (err) {
      toast.error((err as Error).message); return
    }

    setSaving(true)
    const res = await fetch(`/api/admin/topics/${params.topicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: {
          title_ru: topic.title_ru,
          title_kz: topic.title_kz,
          order_num: topic.order_num,
          is_published: topic.is_published,
        },
        explanations: validated,
        questions: questions.map((q, i) => ({
          id: q.id,
          question_ru: q.question_ru,
          question_kz: q.question_kz,
          option_a_ru: q.option_a_ru, option_b_ru: q.option_b_ru, option_c_ru: q.option_c_ru, option_d_ru: q.option_d_ru,
          option_a_kz: q.option_a_kz, option_b_kz: q.option_b_kz, option_c_kz: q.option_c_kz, option_d_kz: q.option_d_kz,
          correct_option: q.correct_option,
          order_num: i + 1,
        })),
      }),
    })
    setSaving(false)
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка сохранения'); return }
    toast.success('Сохранено')
    load()
  }

  if (loading) return <div className="text-sm text-gray-400">Загрузка…</div>
  if (!topic) return <div className="text-sm text-gray-400">Тема не найдена</div>

  return (
    <div className="mx-auto max-w-5xl pb-24">
      <div className="mb-4">
        <Link href={`/admin/courses/${params.courseId}`} className="text-xs text-gray-500 hover:text-[#1ec8c8]">
          ← К темам курса
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-black text-gray-800">{topic.title_ru || 'Без названия'}</h1>

      {/* Основное */}
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-black text-gray-800">Основное</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-500">Название (RU) *</span>
            <input className={INPUT_CLS} value={topic.title_ru} onChange={e => updateTopic('title_ru', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-500">Название (KZ)</span>
            <input className={INPUT_CLS} value={topic.title_kz ?? ''} onChange={e => updateTopic('title_kz', e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-gray-500">Порядок</span>
            <input type="number" className={INPUT_CLS} value={topic.order_num} onChange={e => updateTopic('order_num', Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500">Опубликовано</span>
            <button
              type="button"
              onClick={() => updateTopic('is_published', !topic.is_published)}
              className="relative h-7 w-12 rounded-full"
              style={{ background: topic.is_published ? '#1ec8c8' : '#e5e7eb' }}
            >
              <span
                className="absolute top-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform"
                style={{ transform: topic.is_published ? 'translateX(22px)' : 'translateX(2px)' }}
              />
            </button>
          </label>
        </div>
      </section>

      {/* Динамические секции объяснений */}
      {styles.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-500">
          Нет активных стилей объяснений. Добавьте их в <Link href="/admin/settings" className="text-[#1ec8c8] underline">Настройках</Link>.
        </div>
      ) : (
        styles.map(s => {
          const e = explByStyle[s.code]
          if (!e) return null
          return (
            <section key={s.code} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-black text-gray-800">
                <span className="text-lg">{s.icon}</span>
                <span>{s.name_ru}</span>
                <span className="font-mono text-xs font-normal text-gray-400">{s.code}</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-gray-500">Заголовок (RU)</span>
                  <input className={INPUT_CLS} value={e.title_ru ?? ''} onChange={ev => updateExpl(s.code, { title_ru: ev.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-gray-500">Заголовок (KZ)</span>
                  <input className={INPUT_CLS} value={e.title_kz ?? ''} onChange={ev => updateExpl(s.code, { title_kz: ev.target.value })} />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-bold text-gray-500">Контент (RU)</span>
                  <textarea className={TEXTAREA_CLS} rows={6} value={e.content_ru ?? ''} onChange={ev => updateExpl(s.code, { content_ru: ev.target.value })} />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-bold text-gray-500">Контент (KZ)</span>
                  <textarea className={TEXTAREA_CLS} rows={6} value={e.content_kz ?? ''} onChange={ev => updateExpl(s.code, { content_kz: ev.target.value })} />
                </label>
                <div className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-bold text-gray-500">Видео (Bunny Stream)</span>
                  <VideoUploader
                    videoId={e.video_id ?? null}
                    onVideoChange={vid => updateExpl(s.code, { video_id: vid })}
                  />
                </div>
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-xs font-bold text-gray-500">URL изображения</span>
                  <input className={INPUT_CLS} value={e.image_url ?? ''} onChange={ev => updateExpl(s.code, { image_url: ev.target.value })} placeholder="https://..." />
                </label>
              </div>
            </section>
          )
        })
      )}

      {/* Тест */}
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-black text-gray-800">Тест ({questions.length} вопросов)</h2>
          <button className={BTN_SECONDARY_CLS} onClick={addQuestion} type="button">+ Добавить вопрос</button>
        </div>
        {questions.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Пока нет вопросов</div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id ?? q._temp}
                idx={i}
                q={q}
                onChange={patch => updateQuestion(i, patch)}
                onRemove={() => removeQuestion(i)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Sticky save */}
      <div className="fixed bottom-0 left-56 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur px-6 py-3 shadow-lg">
        <div className="mx-auto flex max-w-5xl justify-end">
          <button
            type="button"
            onClick={saveAll}
            disabled={saving}
            className={BTN_PRIMARY_CLS}
            style={BTN_PRIMARY_STYLE}
          >
            {saving ? 'Сохранение…' : '💾 Сохранить всё'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionCard({
  idx, q, onChange, onRemove,
}: {
  idx: number
  q: QuestionState
  onChange: (patch: Partial<QuestionState>) => void
  onRemove: () => void
}) {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-3 top-3 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-400 hover:border-red-300 hover:text-red-500"
      >
        🗑️
      </button>

      <div className="mb-3 font-bold text-gray-700">Вопрос {idx + 1}</div>

      <label className="mb-2 block">
        <span className="mb-1 block text-xs font-bold text-gray-500">Вопрос (RU) *</span>
        <input className={INPUT_CLS} value={q.question_ru} onChange={e => onChange({ question_ru: e.target.value })} />
      </label>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-bold text-gray-500">Вопрос (KZ)</span>
        <input className={INPUT_CLS} value={q.question_kz} onChange={e => onChange({ question_kz: e.target.value })} />
      </label>

      <div className="mb-1 text-xs font-bold text-gray-500">Варианты RU:</div>
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
        <input className={INPUT_CLS} placeholder="A" value={q.option_a_ru} onChange={e => onChange({ option_a_ru: e.target.value })} />
        <input className={INPUT_CLS} placeholder="B" value={q.option_b_ru} onChange={e => onChange({ option_b_ru: e.target.value })} />
        <input className={INPUT_CLS} placeholder="C" value={q.option_c_ru} onChange={e => onChange({ option_c_ru: e.target.value })} />
        <input className={INPUT_CLS} placeholder="D" value={q.option_d_ru} onChange={e => onChange({ option_d_ru: e.target.value })} />
      </div>

      <div className="mb-1 text-xs font-bold text-gray-500">Варианты KZ:</div>
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
        <input className={INPUT_CLS} placeholder="A" value={q.option_a_kz} onChange={e => onChange({ option_a_kz: e.target.value })} />
        <input className={INPUT_CLS} placeholder="B" value={q.option_b_kz} onChange={e => onChange({ option_b_kz: e.target.value })} />
        <input className={INPUT_CLS} placeholder="C" value={q.option_c_kz} onChange={e => onChange({ option_c_kz: e.target.value })} />
        <input className={INPUT_CLS} placeholder="D" value={q.option_d_kz} onChange={e => onChange({ option_d_kz: e.target.value })} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500">Правильный ответ:</span>
        {(['A', 'B', 'C', 'D'] as const).map(opt => {
          const active = q.correct_option === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ correct_option: opt })}
              className="flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold transition-all"
              style={{
                background: active ? '#0fa8a8' : '#fff',
                color: active ? '#fff' : '#6b7280',
                borderColor: active ? '#0fa8a8' : '#e5e7eb',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
