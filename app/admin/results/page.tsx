'use client'

import { useEffect, useState } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────
interface SubjectScore { name_ru: string; name_kz: string; score: number; total: number }
interface ResultRow {
  id: string; student_id: string; score: number; total_questions: number
  cert_type: string; passed_to_round2: boolean; completed_at: string
  subject_scores: SubjectScore[] | null
  students: { full_name: string; school: string | null; grade: string | null; district: string | null; language: string } | null
}
interface Subject { name_ru: string; name_kz: string; from_q: number; to_q: number }
interface Olympiad { id: string; name_ru: string }
interface QuestionStat {
  question_id: string; order_num: number; question_ru: string; question_kz: string
  correct_option: string; total_answers: number; correct_count: number
  option_counts: Record<string, number>
}
interface Summary { total: number; passed: number; avg_score: number; avg_pct: number; avg_time_ms: number | null }
interface ProfileAnswer {
  order_num: number; question_ru: string; question_kz: string; type: string
  selected_option: string | null; correct_option: string; is_correct: boolean; time_from_start_ms: number | null
}
interface ProfileData {
  student: { full_name: string; school: string | null; grade: string | null; district: string | null; language: string } | null
  result: { score: number; total_questions: number; cert_type: string; passed_to_round2: boolean; completed_at: string; subject_scores: SubjectScore[] | null } | null
  started_at: string | null; answers: ProfileAnswer[]
}

// ── Constants ────────────────────────────────────────────────────────────────
const CERT_COLORS: Record<string, string> = { winner: '#f47920', prize: '#1ec8c8', participant: '#6b7280' }
const CERT_LABELS: Record<string, string> = { winner: 'Победитель', prize: 'Призёр', participant: 'Участник' }
const OPT_LABELS = ['A', 'B', 'C', 'D']
const DISTRICTS = [
  'Қызылорда қаласы', 'Арал ауданы', 'Жалағаш ауданы', 'Қармақшы ауданы',
  'Қазалы ауданы', 'Сырдария ауданы', 'Шиелі ауданы', 'Жаңақорған ауданы',
]

function fmtTime(ms: number | null): string {
  if (!ms) return '—'
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000)
  return `${m}м ${s}с`
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [selectedOlympiad, setSelectedOlympiad] = useState('')
  const [results, setResults] = useState<ResultRow[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [tab, setTab] = useState<'table' | 'questions' | 'districts' | 'subjects'>('table')
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'score', dir: 'desc' })
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all')
  const [filterLang, setFilterLang] = useState('')
  const [search, setSearch] = useState('')
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/olympiads').then(r => r.json()).then(data => {
      setOlympiads(data)
      if (data.length > 0) setSelectedOlympiad(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedOlympiad) return
    Promise.all([
      fetch(`/api/admin/results?olympiad_id=${selectedOlympiad}`).then(r => r.json()),
      fetch(`/api/admin/analytics?olympiad_id=${selectedOlympiad}`).then(r => r.json()),
    ]).then(([res, an]) => {
      setResults(res.results ?? [])
      setSubjects(res.subjects ?? [])
      setSummary(an.summary ?? null)
      setQuestionStats(an.question_stats ?? [])
    })
  }, [selectedOlympiad])

  async function openProfile(studentId: string) {
    setProfileId(studentId)
    setProfileData(null)
    setProfileLoading(true)
    const data = await fetch(`/api/admin/analytics/student?student_id=${studentId}&olympiad_id=${selectedOlympiad}`).then(r => r.json())
    setProfileData(data)
    setProfileLoading(false)
  }

  // ── Sorting ────────────────────────────────────────────────────────────────
  function toggleSort(col: string) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })
  }

  function sortIndicator(col: string) {
    if (sort.col !== col) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1" style={{ color: '#1ec8c8' }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Filtering + Sorting ────────────────────────────────────────────────────
  const filtered = results
    .filter(r => filterStatus === 'all' ? true : filterStatus === 'passed' ? r.passed_to_round2 : !r.passed_to_round2)
    .filter(r => !filterDistrict || r.students?.district === filterDistrict)
    .filter(r => !filterLang || r.students?.language === filterLang)
    .filter(r => !search || r.students?.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va: number, vb: number
      if (sort.col === 'score') { va = a.score; vb = b.score }
      else if (sort.col === 'pct') { va = a.score / Math.max(a.total_questions, 1); vb = b.score / Math.max(b.total_questions, 1) }
      else {
        const sa = (a.subject_scores ?? []).find(s => s.name_ru === sort.col)
        const sb = (b.subject_scores ?? []).find(s => s.name_ru === sort.col)
        va = sa ? sa.score / Math.max(sa.total, 1) : -1
        vb = sb ? sb.score / Math.max(sb.total, 1) : -1
      }
      return sort.dir === 'asc' ? va - vb : vb - va
    })

  // ── District stats ─────────────────────────────────────────────────────────
  const districtStats = DISTRICTS.map(d => {
    const rows = results.filter(r => r.students?.district === d)
    if (!rows.length) return null
    const avgScore = rows.reduce((s, r) => s + r.score, 0) / rows.length
    const subjectAvgs = subjects.map(s => {
      const vals = rows.map(r => (r.subject_scores ?? []).find(ss => ss.name_ru === s.name_ru)).filter(Boolean)
      const avg = vals.length ? vals.reduce((acc, v) => acc + v!.score / Math.max(v!.total, 1) * 100, 0) / vals.length : 0
      return { name_ru: s.name_ru, avg: Math.round(avg) }
    })
    return { district: d, count: rows.length, passed: rows.filter(r => r.passed_to_round2).length, avgScore: Math.round(avgScore * 10) / 10, subjectAvgs }
  }).filter(Boolean) as { district: string; count: number; passed: number; avgScore: number; subjectAvgs: { name_ru: string; avg: number }[] }[]

  // ── Subject stats ──────────────────────────────────────────────────────────
  const subjectStats = subjects.map(s => {
    const allVals = results.map(r => (r.subject_scores ?? []).find(ss => ss.name_ru === s.name_ru)).filter(Boolean)
    const avgPct = allVals.length ? allVals.reduce((acc, v) => acc + v!.score / Math.max(v!.total, 1) * 100, 0) / allVals.length : 0
    const qInRange = questionStats.filter(q => q.order_num >= s.from_q && q.order_num <= s.to_q)
    const best = qInRange.length ? qInRange.reduce((a, b) => (a.total_answers ? a.correct_count / a.total_answers : 0) > (b.total_answers ? b.correct_count / b.total_answers : 0) ? a : b) : null
    const worst = qInRange.length ? qInRange.reduce((a, b) => (a.total_answers ? a.correct_count / a.total_answers : 1) < (b.total_answers ? b.correct_count / b.total_answers : 1) ? a : b) : null
    return { name_ru: s.name_ru, avgPct: Math.round(avgPct), best, worst }
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-800">Результаты</h1>
        <button onClick={() => window.open(`/api/admin/results/export?olympiad_id=${selectedOlympiad}`, '_blank')}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:border-[#1ec8c8] hover:text-[#1ec8c8]">
          ↓ Excel
        </button>
      </div>

      {/* Olympiad selector */}
      <select value={selectedOlympiad} onChange={e => setSelectedOlympiad(e.target.value)}
        className="mb-5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1ec8c8]">
        {olympiads.map(o => <option key={o.id} value={o.id}>{o.name_ru}</option>)}
      </select>

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-5 gap-3">
          {[
            { label: 'Участников', value: summary.total, color: '#1ec8c8' },
            { label: 'Завершили', value: results.length, color: '#1ec8c8' },
            { label: 'Прошли 2 тур', value: summary.passed, color: '#f47920' },
            { label: 'Средний балл', value: `${summary.avg_score} (${summary.avg_pct}%)`, color: '#e8206e' },
            { label: 'Среднее время', value: fmtTime(summary.avg_time_ms), color: '#6b7280' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-1 font-mono text-xs text-gray-400">{c.label}</div>
              <div className="font-black text-lg" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex overflow-hidden rounded-xl border border-gray-200">
        {([['table', 'Таблица'], ['questions', 'По вопросам'], ['districts', 'По районам'], ['subjects', 'По предметам']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 px-3 py-2 text-sm transition-all"
            style={{ background: tab === t ? '#f0fdfa' : '#fff', color: tab === t ? '#1ec8c8' : '#6b7280', fontWeight: tab === t ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Table ──────────────────────────────────────────────────────── */}
      {tab === 'table' && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex overflow-hidden rounded-xl border border-gray-200">
              {(['all', 'passed', 'failed'] as const).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)}
                  className="px-3 py-2 text-sm transition-all"
                  style={{ background: filterStatus === f ? '#f0fdfa' : '#fff', color: filterStatus === f ? '#1ec8c8' : '#6b7280' }}>
                  {f === 'all' ? 'Все' : f === 'passed' ? 'Прошли' : 'Не прошли'}
                </button>
              ))}
            </div>
            <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1ec8c8]">
              <option value="">Все районы</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterLang} onChange={e => setFilterLang(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#1ec8c8]">
              <option value="">Все языки</option>
              <option value="ru">Русский</option>
              <option value="kz">Қазақша</option>
            </select>
            <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-[#1ec8c8]" />
          </div>
          <div className="overflow-x-auto overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">#</th>
                  <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">ФИО</th>
                  <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Класс</th>
                  <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Район</th>
                  <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Язык</th>
                  <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Школа</th>
                  {subjects.map(s => (
                    <th key={s.name_ru} onClick={() => toggleSort(s.name_ru)}
                      className="cursor-pointer whitespace-nowrap px-4 py-3 text-left font-mono text-xs font-bold text-[#1ec8c8]">
                      {s.name_ru} ⭐{sortIndicator(s.name_ru)}
                    </th>
                  ))}
                  <th onClick={() => toggleSort('score')}
                    className="cursor-pointer px-4 py-3 text-left font-mono text-xs font-bold text-[#f47920]">
                    Итого{sortIndicator('score')}
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Уровень</th>
                  <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const subMap = new Map((r.subject_scores ?? []).map(s => [s.name_ru, s]))
                  return (
                    <tr key={r.id}
                      onClick={() => openProfile(r.student_id)}
                      className="cursor-pointer border-b border-gray-50 hover:bg-[#f0fdfa]">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{r.students?.full_name ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.students?.grade ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.students?.district ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.students?.language === 'kz' ? 'ҚАЗ' : 'РУС'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.students?.school ?? '—'}</td>
                      {subjects.map(s => {
                        const ss = subMap.get(s.name_ru)
                        return (
                          <td key={s.name_ru} className="px-4 py-3 font-mono text-xs">
                            {ss ? (
                              <span style={{ color: ss.score / Math.max(ss.total, 1) >= 0.8 ? '#f47920' : ss.score / Math.max(ss.total, 1) >= 0.5 ? '#1ec8c8' : '#6b7280' }}>
                                {ss.score}/{ss.total}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 font-mono font-bold text-[#f47920]">{r.score}/{r.total_questions}</td>
                      <td className="px-4 py-3">
                        <span className="rounded px-2 py-0.5 font-mono text-xs"
                          style={{ background: CERT_COLORS[r.cert_type] + '18', color: CERT_COLORS[r.cert_type] }}>
                          {CERT_LABELS[r.cert_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.passed_to_round2
                          ? <span className="text-xs text-[#1ec8c8]">✓</span>
                          : <span className="text-xs text-gray-400">✗</span>}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8 + subjects.length} className="py-12 text-center text-gray-400">Нет результатов</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Tab: Questions ───────────────────────────────────────────────────── */}
      {tab === 'questions' && (
        <div className="flex flex-col gap-3">
          {questionStats.length === 0 && <div className="py-12 text-center text-gray-400">Нет данных</div>}
          {questionStats.map(q => {
            const pct = q.total_answers > 0 ? Math.round((q.correct_count / q.total_answers) * 100) : 0
            const mostChosen = Object.entries(q.option_counts).sort((a, b) => b[1] - a[1])[0]?.[0]
            return (
              <div key={q.question_id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-3">
                  <span className="font-mono text-xs text-gray-400">#{q.order_num}</span>
                  <span className="flex-1 text-sm text-gray-800">{q.question_ru}</span>
                  <span className="font-mono text-xs" style={{ color: pct >= 70 ? '#1ec8c8' : pct >= 40 ? '#f47920' : '#e8206e' }}>
                    {pct}% правильно
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct >= 70 ? '#1ec8c8' : pct >= 40 ? '#f47920' : '#e8206e' }} />
                </div>
                {/* Option distribution */}
                <div className="flex gap-2">
                  {(['a', 'b', 'c', 'd'] as const).map((opt, oi) => {
                    const count = q.option_counts[opt] ?? 0
                    const optPct = q.total_answers > 0 ? Math.round((count / q.total_answers) * 100) : 0
                    const isCorrect = q.correct_option === opt
                    const isMost = mostChosen === opt && !isCorrect
                    return (
                      <div key={opt} className="flex-1 rounded-lg p-2 text-center"
                        style={{ background: isCorrect ? '#1ec8c818' : isMost ? '#f4792010' : '#f9fafb', border: `1px solid ${isCorrect ? '#1ec8c866' : '#e5e7eb'}` }}>
                        <div className="font-mono text-xs font-bold" style={{ color: isCorrect ? '#1ec8c8' : '#6b7280' }}>
                          {OPT_LABELS[oi]}{isCorrect ? ' ✓' : ''}
                        </div>
                        <div className="font-mono text-sm font-black" style={{ color: isCorrect ? '#1ec8c8' : isMost ? '#f47920' : '#9ca3af' }}>
                          {optPct}%
                        </div>
                        <div className="font-mono text-xs text-gray-400">{count}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Districts ───────────────────────────────────────────────────── */}
      {tab === 'districts' && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Район</th>
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-gray-400">Участ.</th>
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-[#f47920]">2 тур</th>
                <th className="px-4 py-3 text-left font-mono text-xs font-bold text-[#1ec8c8]">Ср. балл</th>
                {subjects.map(s => (
                  <th key={s.name_ru} className="px-4 py-3 text-left font-mono text-xs font-bold text-[#1ec8c8] whitespace-nowrap">{s.name_ru}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {districtStats.length === 0 && (
                <tr><td colSpan={4 + subjects.length} className="py-12 text-center text-gray-400">Нет данных</td></tr>
              )}
              {districtStats.sort((a, b) => b.avgScore - a.avgScore).map(d => (
                <tr key={d.district} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{d.district}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.count}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#f47920]">{d.passed}</td>
                  <td className="px-4 py-3 font-mono font-bold text-[#1ec8c8]">{d.avgScore}</td>
                  {d.subjectAvgs.map(sa => (
                    <td key={sa.name_ru} className="px-4 py-3 font-mono text-xs"
                      style={{ color: sa.avg >= 70 ? '#1ec8c8' : sa.avg >= 40 ? '#f47920' : '#6b7280' }}>
                      {sa.avg}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Subjects ────────────────────────────────────────────────────── */}
      {tab === 'subjects' && (
        <div className="flex flex-col gap-4">
          {subjectStats.length === 0 && <div className="py-12 text-center text-gray-400">Нет данных</div>}
          {subjectStats.map(s => (
            <div key={s.name_ru} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-black text-gray-800">{s.name_ru}</h3>
                <span className="font-mono text-2xl font-black" style={{ color: s.avgPct >= 70 ? '#1ec8c8' : s.avgPct >= 40 ? '#f47920' : '#e8206e' }}>
                  {s.avgPct}%
                </span>
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: `${s.avgPct}%`, background: 'linear-gradient(90deg, #0fa8a8, #1ec8c8)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {s.best && (
                  <div className="rounded-xl border border-[#1ec8c833] bg-[#f0fdfa] p-3">
                    <div className="mb-1 font-mono text-xs text-[#1ec8c8]">✓ Самый лёгкий вопрос #{s.best.order_num}</div>
                    <div className="text-xs text-gray-700 line-clamp-2">{s.best.question_ru}</div>
                    <div className="mt-1 font-mono text-xs font-bold text-[#1ec8c8]">
                      {s.best.total_answers > 0 ? Math.round(s.best.correct_count / s.best.total_answers * 100) : 0}% правильно
                    </div>
                  </div>
                )}
                {s.worst && (
                  <div className="rounded-xl border border-[#e8206e33] bg-[#fff5f8] p-3">
                    <div className="mb-1 font-mono text-xs text-[#e8206e]">✗ Самый сложный вопрос #{s.worst.order_num}</div>
                    <div className="text-xs text-gray-700 line-clamp-2">{s.worst.question_ru}</div>
                    <div className="mt-1 font-mono text-xs font-bold text-[#e8206e]">
                      {s.worst.total_answers > 0 ? Math.round(s.worst.correct_count / s.worst.total_answers * 100) : 0}% правильно
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Student Profile Modal ─────────────────────────────────────────────── */}
      {profileId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8"
          onClick={e => { if (e.target === e.currentTarget) setProfileId(null) }}>
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <div className="font-black text-gray-800">{profileData?.student?.full_name ?? '...'}</div>
                <div className="font-mono text-xs text-gray-400">
                  {profileData?.student?.grade} · {profileData?.student?.district} · {profileData?.student?.school}
                </div>
              </div>
              <button onClick={() => setProfileId(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            {profileLoading && <div className="py-12 text-center text-gray-400">Загрузка...</div>}

            {profileData && !profileLoading && (
              <>
                {/* Result summary */}
                {profileData.result && (
                  <div className="grid grid-cols-4 gap-3 border-b border-gray-100 p-4">
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-400">Балл</div>
                      <div className="font-black text-lg text-[#f47920]">{profileData.result.score}/{profileData.result.total_questions}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-400">Уровень</div>
                      <div className="font-bold text-sm" style={{ color: CERT_COLORS[profileData.result.cert_type] }}>
                        {CERT_LABELS[profileData.result.cert_type]}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-400">2 тур</div>
                      <div className="font-bold text-sm" style={{ color: profileData.result.passed_to_round2 ? '#1ec8c8' : '#6b7280' }}>
                        {profileData.result.passed_to_round2 ? 'Да' : 'Нет'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-xs text-gray-400">Время</div>
                      <div className="font-bold text-sm text-gray-700">
                        {profileData.started_at && profileData.result.completed_at
                          ? fmtTime(new Date(profileData.result.completed_at).getTime() - new Date(profileData.started_at).getTime())
                          : '—'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Answers list */}
                <div className="max-h-[60vh] overflow-y-auto p-4">
                  <div className="flex flex-col gap-2">
                    {profileData.answers.map(a => (
                      <div key={a.order_num}
                        className="flex items-start gap-3 rounded-xl p-3"
                        style={{ background: a.selected_option === null ? '#f9fafb' : a.is_correct ? '#f0fdfa' : '#fff5f5', border: `1px solid ${a.is_correct ? '#1ec8c833' : a.selected_option ? '#e8206e22' : '#e5e7eb'}` }}>
                        <span className="mt-0.5 font-mono text-xs text-gray-400 w-6 shrink-0">#{a.order_num}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-700 mb-1 line-clamp-2">{a.question_ru}</div>
                          <div className="flex gap-2 flex-wrap">
                            {a.selected_option ? (
                              <span className="font-mono text-xs font-bold rounded px-1.5 py-0.5"
                                style={{ background: a.is_correct ? '#1ec8c818' : '#e8206e18', color: a.is_correct ? '#1ec8c8' : '#e8206e' }}>
                                {a.is_correct ? '✓' : '✗'} {a.selected_option.toUpperCase()}
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-gray-400 rounded px-1.5 py-0.5 bg-gray-100">— пропущен</span>
                            )}
                            {!a.is_correct && (
                              <span className="font-mono text-xs text-[#1ec8c8] rounded px-1.5 py-0.5 bg-[#1ec8c818]">
                                правильно: {a.correct_option.toUpperCase()}
                              </span>
                            )}
                            {a.time_from_start_ms !== null && (
                              <span className="font-mono text-xs text-gray-400">{fmtTime(a.time_from_start_ms)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
