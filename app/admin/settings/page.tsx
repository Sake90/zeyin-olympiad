'use client'

import { useEffect, useState } from 'react'
import { Collapsible } from '@/components/admin/Collapsible'
import { useToast } from '@/components/admin/Toast'
import type {
  PlatformConfig, ExplanationStyle, XpLevel, BirdStage, BirdMood, ConfigCategory,
} from '@/lib/supabase'

const INPUT_CLS = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#1ec8c8]'
const BTN_PRIMARY_CLS = 'rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50'
const BTN_PRIMARY_STYLE = { background: 'linear-gradient(135deg, #0fa8a8, #1ec8c8)' }
const BTN_SECONDARY_CLS = 'rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:border-gray-300'
const BTN_GHOST_CLS = 'rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:border-gray-300'

const CATEGORY_LABELS: Record<ConfigCategory, { label: string; icon: string }> = {
  test:       { label: 'Тесты',       icon: '📝' },
  xp:         { label: 'XP',          icon: '⭐' },
  streak:     { label: 'Стрик',       icon: '🔥' },
  bird:       { label: 'Птица',       icon: '🐦' },
  diagnostic: { label: 'Диагностика', icon: '🧪' },
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-800">Настройки платформы</h1>
        <p className="text-sm text-gray-500">Параметры теста, XP, стрика, птицы и справочники</p>
      </div>

      <Collapsible title="Основные параметры" icon="⚙️" defaultOpen>
        <ConfigSection />
      </Collapsible>

      <Collapsible title="Стили объяснений" icon="💡">
        <ExplanationStylesSection />
      </Collapsible>

      <Collapsible title="Уровни XP" icon="⭐">
        <XpLevelsSection />
      </Collapsible>

      <Collapsible title="Стадии птицы" icon="🐦">
        <BirdStagesSection />
      </Collapsible>

      <Collapsible title="Настроения птицы" icon="😊">
        <BirdMoodsSection />
      </Collapsible>
    </div>
  )
}

// ─────────────────────────── Config ───────────────────────────
function ConfigSection() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<ConfigCategory | null>(null)
  const [rows, setRows] = useState<PlatformConfig[]>([])

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/settings/config')
    if (!r.ok) { toast.error('Не удалось загрузить параметры'); setLoading(false); return }
    setRows(await r.json())
    setLoading(false)
  }

  function updateRow(key: string, value: string) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, value } : r))
  }

  async function saveCategory(cat: ConfigCategory) {
    setSaving(cat)
    const items = rows.filter(r => r.category === cat).map(r => ({ key: r.key, value: r.value }))
    const res = await fetch('/api/admin/settings/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    })
    setSaving(null)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Ошибка' }))
      toast.error(error || 'Ошибка при сохранении')
      return
    }
    toast.success('Сохранено')
  }

  if (loading) return <div className="text-sm text-gray-400">Загрузка…</div>
  if (rows.length === 0) return <div className="text-sm text-gray-400">Нет параметров. Добавьте их в platform_config.</div>

  const categories = (Object.keys(CATEGORY_LABELS) as ConfigCategory[])
    .filter(cat => rows.some(r => r.category === cat))

  return (
    <div className="space-y-4">
      {categories.map(cat => {
        const items = rows.filter(r => r.category === cat)
        const meta = CATEGORY_LABELS[cat]
        return (
          <div key={cat} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span>{meta.icon}</span>
              <h3 className="text-sm font-black text-gray-700">{meta.label}</h3>
            </div>
            <div className="space-y-3">
              {items.map(item => (
                <ConfigRow key={item.key} row={item} onChange={v => updateRow(item.key, v)} />
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                className={BTN_PRIMARY_CLS}
                style={BTN_PRIMARY_STYLE}
                onClick={() => saveCategory(cat)}
                disabled={saving === cat}
              >
                {saving === cat ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ConfigRow({ row, onChange }: { row: PlatformConfig; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px] md:items-center">
      <div>
        <div className="text-sm font-bold text-gray-800">{row.label_ru || row.key}</div>
        {row.description_ru && (
          <div className="text-xs text-gray-500">{row.description_ru}</div>
        )}
        <div className="mt-0.5 font-mono text-[10px] text-gray-400">{row.key}</div>
      </div>
      <div>
        {row.value_type === 'boolean' ? (
          <BooleanToggle checked={row.value === 'true'} onChange={v => onChange(v ? 'true' : 'false')} />
        ) : row.value_type === 'number' ? (
          <input
            type="number"
            value={row.value}
            onChange={e => onChange(e.target.value)}
            className={INPUT_CLS}
          />
        ) : (
          <input
            type="text"
            value={row.value}
            onChange={e => onChange(e.target.value)}
            className={INPUT_CLS}
          />
        )}
      </div>
    </div>
  )
}

function BooleanToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 rounded-full transition-colors"
      style={{ background: checked ? '#1ec8c8' : '#e5e7eb' }}
    >
      <span
        className="absolute top-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

// ─────────────── Explanation styles ───────────────
function ExplanationStylesSection() {
  const { toast } = useToast()
  const [rows, setRows] = useState<ExplanationStyle[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<ExplanationStyle>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<ExplanationStyle>>({ is_active: true, order_num: 0 })

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/settings/explanation-styles')
    if (!r.ok) { toast.error('Не удалось загрузить'); setLoading(false); return }
    setRows(await r.json())
    setLoading(false)
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/settings/explanation-styles?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setEditingId(null); setDraft({}); toast.success('Сохранено'); load()
  }

  async function toggleActive(row: ExplanationStyle) {
    await fetch(`/api/admin/settings/explanation-styles?id=${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active }),
    })
    load()
  }

  async function swap(idx: number, dir: -1 | 1) {
    const a = rows[idx], b = rows[idx + dir]
    if (!a || !b) return
    await Promise.all([
      fetch(`/api/admin/settings/explanation-styles?id=${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_num: b.order_num }),
      }),
      fetch(`/api/admin/settings/explanation-styles?id=${b.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_num: a.order_num }),
      }),
    ])
    load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить стиль?')) return
    const res = await fetch(`/api/admin/settings/explanation-styles?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}))
      toast.error(error || 'Ошибка удаления'); return
    }
    toast.success('Удалено'); load()
  }

  async function createNew() {
    if (!newRow.code || !newRow.name_ru) { toast.error('code и name_ru обязательны'); return }
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order_num), 0)
    const res = await fetch('/api/admin/settings/explanation-styles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRow, order_num: maxOrder + 1 }),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setAdding(false); setNewRow({ is_active: true, order_num: 0 }); toast.success('Добавлено'); load()
  }

  if (loading) return <div className="text-sm text-gray-400">Загрузка…</div>

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">icon</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">name_ru</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">name_kz</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">code</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">active</th>
              <th className="px-2 py-2 font-mono text-xs font-bold text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const editing = editingId === r.id
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.icon ?? ''} onChange={e => setDraft(d => ({ ...d, icon: e.target.value }))} /> : <span className="text-lg">{r.icon}</span>}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.name_ru} onChange={e => setDraft(d => ({ ...d, name_ru: e.target.value }))} /> : r.name_ru}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.name_kz} onChange={e => setDraft(d => ({ ...d, name_kz: e.target.value }))} /> : r.name_kz}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-gray-500">{r.code}</td>
                  <td className="px-2 py-2">
                    <BooleanToggle checked={r.is_active} onChange={() => toggleActive(r)} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className={BTN_GHOST_CLS} disabled={idx === 0} onClick={() => swap(idx, -1)}>↑</button>
                      <button className={BTN_GHOST_CLS} disabled={idx === rows.length - 1} onClick={() => swap(idx, 1)}>↓</button>
                      {editing ? (
                        <>
                          <button className={BTN_PRIMARY_CLS + ' !px-2 !py-1'} style={BTN_PRIMARY_STYLE} onClick={() => saveEdit(r.id)}>OK</button>
                          <button className={BTN_GHOST_CLS} onClick={() => { setEditingId(null); setDraft({}) }}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className={BTN_GHOST_CLS} onClick={() => { setEditingId(r.id); setDraft({}) }}>✎</button>
                          <button className={BTN_GHOST_CLS + ' hover:border-red-300 hover:text-red-500'} onClick={() => remove(r.id)}>🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-300 p-3 md:grid-cols-[80px_1fr_1fr_1fr_auto]">
          <input className={INPUT_CLS} placeholder="icon" value={newRow.icon ?? ''} onChange={e => setNewRow(v => ({ ...v, icon: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="name_ru" value={newRow.name_ru ?? ''} onChange={e => setNewRow(v => ({ ...v, name_ru: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="name_kz" value={newRow.name_kz ?? ''} onChange={e => setNewRow(v => ({ ...v, name_kz: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="code" value={newRow.code ?? ''} onChange={e => setNewRow(v => ({ ...v, code: e.target.value }))} />
          <div className="flex gap-2">
            <button className={BTN_PRIMARY_CLS} style={BTN_PRIMARY_STYLE} onClick={createNew}>Создать</button>
            <button className={BTN_SECONDARY_CLS} onClick={() => setAdding(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className={BTN_SECONDARY_CLS + ' mt-4'} onClick={() => setAdding(true)}>+ Добавить стиль</button>
      )}
    </div>
  )
}

// ─────────────── XP levels ───────────────
function XpLevelsSection() {
  const { toast } = useToast()
  const [rows, setRows] = useState<XpLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<XpLevel>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<XpLevel>>({ min_xp: 0, order_num: 0 })

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/settings/xp-levels')
    if (!r.ok) { toast.error('Не удалось загрузить'); setLoading(false); return }
    setRows(await r.json())
    setLoading(false)
  }

  async function saveEdit(id: string) {
    const payload = { ...draft }
    if (payload.min_xp !== undefined) payload.min_xp = Number(payload.min_xp)
    const res = await fetch(`/api/admin/settings/xp-levels?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setEditingId(null); setDraft({}); toast.success('Сохранено'); load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить уровень?')) return
    const res = await fetch(`/api/admin/settings/xp-levels?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    toast.success('Удалено'); load()
  }

  async function createNew() {
    if (!newRow.code || !newRow.name_ru) { toast.error('code и name_ru обязательны'); return }
    if (newRow.min_xp === undefined || Number(newRow.min_xp) < 0) { toast.error('min_xp >= 0'); return }
    const res = await fetch('/api/admin/settings/xp-levels', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRow, min_xp: Number(newRow.min_xp) }),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setAdding(false); setNewRow({ min_xp: 0, order_num: 0 }); toast.success('Добавлено'); load()
  }

  if (loading) return <div className="text-sm text-gray-400">Загрузка…</div>

  const maxXp = rows.reduce((m, r) => Math.max(m, r.min_xp), 100)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">icon</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">name_ru</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">name_kz</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">code</th>
              <th className="px-2 py-2 text-right font-mono text-xs font-bold text-gray-400">min_xp</th>
              <th className="px-2 py-2 font-mono text-xs font-bold text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const editing = editingId === r.id
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.icon ?? ''} onChange={e => setDraft(d => ({ ...d, icon: e.target.value }))} /> : <span className="text-lg">{r.icon}</span>}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.name_ru} onChange={e => setDraft(d => ({ ...d, name_ru: e.target.value }))} /> : r.name_ru}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.name_kz} onChange={e => setDraft(d => ({ ...d, name_kz: e.target.value }))} /> : r.name_kz}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-gray-500">{r.code}</td>
                  <td className="px-2 py-2 text-right">
                    {editing ? <input type="number" className={INPUT_CLS} defaultValue={r.min_xp} onChange={e => setDraft(d => ({ ...d, min_xp: Number(e.target.value) }))} /> : r.min_xp}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editing ? (
                        <>
                          <button className={BTN_PRIMARY_CLS + ' !px-2 !py-1'} style={BTN_PRIMARY_STYLE} onClick={() => saveEdit(r.id)}>OK</button>
                          <button className={BTN_GHOST_CLS} onClick={() => { setEditingId(null); setDraft({}) }}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className={BTN_GHOST_CLS} onClick={() => { setEditingId(r.id); setDraft({}) }}>✎</button>
                          <button className={BTN_GHOST_CLS + ' hover:border-red-300 hover:text-red-500'} onClick={() => remove(r.id)}>🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="mb-2 text-xs font-bold text-gray-500">Превью шкалы</div>
          <div className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg, #e5e7eb, #1ec8c8)' }}>
            {rows.map(r => {
              const pct = Math.max(0, Math.min(100, (r.min_xp / maxXp) * 100))
              return (
                <div key={r.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${pct}%` }}>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow" style={{ border: '2px solid #1ec8c8' }}>
                    {r.icon || '•'}
                  </div>
                  <div className="mt-1 whitespace-nowrap text-[10px] text-gray-500">{r.name_ru}</div>
                  <div className="font-mono text-[9px] text-gray-400">{r.min_xp}</div>
                </div>
              )
            })}
          </div>
          <div className="h-12" />
        </div>
      )}

      {adding ? (
        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-300 p-3 md:grid-cols-[80px_1fr_1fr_1fr_100px_auto]">
          <input className={INPUT_CLS} placeholder="icon" value={newRow.icon ?? ''} onChange={e => setNewRow(v => ({ ...v, icon: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="name_ru" value={newRow.name_ru ?? ''} onChange={e => setNewRow(v => ({ ...v, name_ru: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="name_kz" value={newRow.name_kz ?? ''} onChange={e => setNewRow(v => ({ ...v, name_kz: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="code" value={newRow.code ?? ''} onChange={e => setNewRow(v => ({ ...v, code: e.target.value }))} />
          <input type="number" className={INPUT_CLS} placeholder="min_xp" value={newRow.min_xp ?? 0} onChange={e => setNewRow(v => ({ ...v, min_xp: Number(e.target.value) }))} />
          <div className="flex gap-2">
            <button className={BTN_PRIMARY_CLS} style={BTN_PRIMARY_STYLE} onClick={createNew}>Создать</button>
            <button className={BTN_SECONDARY_CLS} onClick={() => setAdding(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className={BTN_SECONDARY_CLS + ' mt-4'} onClick={() => setAdding(true)}>+ Добавить уровень</button>
      )}
    </div>
  )
}

// ─────────────── Bird stages ───────────────
function BirdStagesSection() {
  const { toast } = useToast()
  const [rows, setRows] = useState<BirdStage[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<BirdStage>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<BirdStage>>({ min_days_active: 0, order_num: 0 })

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/settings/bird-stages')
    if (!r.ok) { toast.error('Не удалось загрузить'); setLoading(false); return }
    setRows(await r.json())
    setLoading(false)
  }

  async function saveEdit(id: string) {
    const payload = { ...draft }
    if (payload.min_days_active !== undefined) payload.min_days_active = Number(payload.min_days_active)
    const res = await fetch(`/api/admin/settings/bird-stages?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setEditingId(null); setDraft({}); toast.success('Сохранено'); load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить стадию?')) return
    const res = await fetch(`/api/admin/settings/bird-stages?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    toast.success('Удалено'); load()
  }

  async function createNew() {
    if (!newRow.code || !newRow.name_ru) { toast.error('code и name_ru обязательны'); return }
    if (newRow.min_days_active === undefined || Number(newRow.min_days_active) < 0) {
      toast.error('min_days_active >= 0'); return
    }
    const res = await fetch('/api/admin/settings/bird-stages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRow, min_days_active: Number(newRow.min_days_active) }),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setAdding(false); setNewRow({ min_days_active: 0, order_num: 0 }); toast.success('Добавлено'); load()
  }

  if (loading) return <div className="text-sm text-gray-400">Загрузка…</div>

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">icon</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">name_ru</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">name_kz</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">code</th>
              <th className="px-2 py-2 text-right font-mono text-xs font-bold text-gray-400">min_days</th>
              <th className="px-2 py-2 font-mono text-xs font-bold text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const editing = editingId === r.id
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.icon ?? ''} onChange={e => setDraft(d => ({ ...d, icon: e.target.value }))} /> : <span className="text-lg">{r.icon}</span>}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.name_ru} onChange={e => setDraft(d => ({ ...d, name_ru: e.target.value }))} /> : r.name_ru}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.name_kz} onChange={e => setDraft(d => ({ ...d, name_kz: e.target.value }))} /> : r.name_kz}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-gray-500">{r.code}</td>
                  <td className="px-2 py-2 text-right">
                    {editing ? <input type="number" className={INPUT_CLS} defaultValue={r.min_days_active} onChange={e => setDraft(d => ({ ...d, min_days_active: Number(e.target.value) }))} /> : r.min_days_active}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editing ? (
                        <>
                          <button className={BTN_PRIMARY_CLS + ' !px-2 !py-1'} style={BTN_PRIMARY_STYLE} onClick={() => saveEdit(r.id)}>OK</button>
                          <button className={BTN_GHOST_CLS} onClick={() => { setEditingId(null); setDraft({}) }}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className={BTN_GHOST_CLS} onClick={() => { setEditingId(r.id); setDraft({}) }}>✎</button>
                          <button className={BTN_GHOST_CLS + ' hover:border-red-300 hover:text-red-500'} onClick={() => remove(r.id)}>🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div className="mb-3 text-xs font-bold text-gray-500">Превью эволюции</div>
          <div className="flex items-end justify-around gap-2">
            {rows.map((r, i) => (
              <div key={r.id} className="flex flex-col items-center">
                <div className="text-2xl">{r.icon || '🐣'}</div>
                <div className="mt-1 text-xs font-bold text-gray-700">{r.name_ru}</div>
                <div className="font-mono text-[10px] text-gray-400">{r.min_days_active} дн.</div>
                {i < rows.length - 1 && <div className="mt-1 text-gray-300">→</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {adding ? (
        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-300 p-3 md:grid-cols-[80px_1fr_1fr_1fr_120px_auto]">
          <input className={INPUT_CLS} placeholder="icon" value={newRow.icon ?? ''} onChange={e => setNewRow(v => ({ ...v, icon: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="name_ru" value={newRow.name_ru ?? ''} onChange={e => setNewRow(v => ({ ...v, name_ru: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="name_kz" value={newRow.name_kz ?? ''} onChange={e => setNewRow(v => ({ ...v, name_kz: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="code" value={newRow.code ?? ''} onChange={e => setNewRow(v => ({ ...v, code: e.target.value }))} />
          <input type="number" className={INPUT_CLS} placeholder="min_days" value={newRow.min_days_active ?? 0} onChange={e => setNewRow(v => ({ ...v, min_days_active: Number(e.target.value) }))} />
          <div className="flex gap-2">
            <button className={BTN_PRIMARY_CLS} style={BTN_PRIMARY_STYLE} onClick={createNew}>Создать</button>
            <button className={BTN_SECONDARY_CLS} onClick={() => setAdding(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className={BTN_SECONDARY_CLS + ' mt-4'} onClick={() => setAdding(true)}>+ Добавить стадию</button>
      )}
    </div>
  )
}

// ─────────────── Bird moods ───────────────
function BirdMoodsSection() {
  const { toast } = useToast()
  const [rows, setRows] = useState<BirdMood[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<BirdMood>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<BirdMood>>({ order_num: 0 })

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/settings/bird-moods')
    if (!r.ok) { toast.error('Не удалось загрузить'); setLoading(false); return }
    setRows(await r.json())
    setLoading(false)
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/admin/settings/bird-moods?id=${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setEditingId(null); setDraft({}); toast.success('Сохранено'); load()
  }

  async function remove(id: string) {
    if (!confirm('Удалить настроение?')) return
    const res = await fetch(`/api/admin/settings/bird-moods?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    toast.success('Удалено'); load()
  }

  async function createNew() {
    if (!newRow.code || !newRow.name_ru) { toast.error('code и name_ru обязательны'); return }
    const res = await fetch('/api/admin/settings/bird-moods', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newRow),
    })
    if (!res.ok) { const { error } = await res.json().catch(() => ({})); toast.error(error || 'Ошибка'); return }
    setAdding(false); setNewRow({ order_num: 0 }); toast.success('Добавлено'); load()
  }

  if (loading) return <div className="text-sm text-gray-400">Загрузка…</div>

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">icon</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">name_ru</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">trigger_ru</th>
              <th className="px-2 py-2 text-left font-mono text-xs font-bold text-gray-400">css_animation</th>
              <th className="px-2 py-2 font-mono text-xs font-bold text-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const editing = editingId === r.id
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.icon ?? ''} onChange={e => setDraft(d => ({ ...d, icon: e.target.value }))} /> : <span className="text-lg">{r.icon}</span>}
                  </td>
                  <td className="px-2 py-2">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.name_ru} onChange={e => setDraft(d => ({ ...d, name_ru: e.target.value }))} /> : r.name_ru}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-500">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.trigger_ru ?? ''} onChange={e => setDraft(d => ({ ...d, trigger_ru: e.target.value }))} /> : r.trigger_ru}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-gray-500">
                    {editing ? <input className={INPUT_CLS} defaultValue={r.css_animation ?? ''} onChange={e => setDraft(d => ({ ...d, css_animation: e.target.value }))} /> : r.css_animation}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editing ? (
                        <>
                          <button className={BTN_PRIMARY_CLS + ' !px-2 !py-1'} style={BTN_PRIMARY_STYLE} onClick={() => saveEdit(r.id)}>OK</button>
                          <button className={BTN_GHOST_CLS} onClick={() => { setEditingId(null); setDraft({}) }}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className={BTN_GHOST_CLS} onClick={() => { setEditingId(r.id); setDraft({}) }}>✎</button>
                          <button className={BTN_GHOST_CLS + ' hover:border-red-300 hover:text-red-500'} onClick={() => remove(r.id)}>🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-300 p-3 md:grid-cols-[80px_1fr_1fr_1fr_1fr_auto]">
          <input className={INPUT_CLS} placeholder="icon" value={newRow.icon ?? ''} onChange={e => setNewRow(v => ({ ...v, icon: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="name_ru" value={newRow.name_ru ?? ''} onChange={e => setNewRow(v => ({ ...v, name_ru: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="code" value={newRow.code ?? ''} onChange={e => setNewRow(v => ({ ...v, code: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="trigger_ru" value={newRow.trigger_ru ?? ''} onChange={e => setNewRow(v => ({ ...v, trigger_ru: e.target.value }))} />
          <input className={INPUT_CLS} placeholder="css_animation" value={newRow.css_animation ?? ''} onChange={e => setNewRow(v => ({ ...v, css_animation: e.target.value }))} />
          <div className="flex gap-2">
            <button className={BTN_PRIMARY_CLS} style={BTN_PRIMARY_STYLE} onClick={createNew}>Создать</button>
            <button className={BTN_SECONDARY_CLS} onClick={() => setAdding(false)}>Отмена</button>
          </div>
        </div>
      ) : (
        <button className={BTN_SECONDARY_CLS + ' mt-4'} onClick={() => setAdding(true)}>+ Добавить настроение</button>
      )}
    </div>
  )
}
