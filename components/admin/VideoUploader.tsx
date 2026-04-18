'use client'

import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/admin/Toast'

const MAX_FILE_SIZE = 500 * 1024 * 1024
const ALLOWED_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
const BUNNY_STATUS_FINISHED = 4
const BUNNY_STATUS_ERROR = 5
const BUNNY_STATUS_UPLOAD_FAILED = 6

type Phase = 'idle' | 'uploading' | 'processing' | 'ready' | 'error'

export function VideoUploader({
  videoId,
  onVideoChange,
}: {
  videoId: string | null
  onVideoChange: (videoId: string | null) => void
}) {
  const { toast } = useToast()
  const [libraryId, setLibraryId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>(videoId ? 'ready' : 'idle')
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load Bunny libraryId once
  useEffect(() => {
    let alive = true
    fetch('/api/admin/video/config')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { libraryId: string | null }) => { if (alive) setLibraryId(d.libraryId) })
      .catch(() => { if (alive) toast.error('Не удалось загрузить конфиг Bunny') })
    return () => { alive = false }
  }, [toast])

  // When videoId changes from parent: re-check status
  useEffect(() => {
    if (!videoId) {
      setPhase('idle')
      return
    }
    setPhase(p => (p === 'uploading' ? p : 'processing'))
    pollStatus(videoId)
    return stopPolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }
  function stopFakeProgress() {
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null }
  }

  function pollStatus(id: string) {
    stopPolling()
    const tick = async () => {
      try {
        const r = await fetch(`/api/admin/video?videoId=${encodeURIComponent(id)}`, { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json() as { status: number }
        if (d.status === BUNNY_STATUS_FINISHED) {
          setPhase('ready')
          stopPolling()
        } else if (d.status === BUNNY_STATUS_ERROR || d.status === BUNNY_STATUS_UPLOAD_FAILED) {
          setPhase('error')
          setErrorMsg('Видео не удалось обработать на Bunny')
          stopPolling()
        }
      } catch {
        // ignore transient errors
      }
    }
    tick()
    pollRef.current = setInterval(tick, 5000)
  }

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) return 'Файл больше 500MB'
    const name = file.name.toLowerCase()
    if (!ALLOWED_EXT.some(ext => name.endsWith(ext))) {
      return `Формат не поддерживается. Допустимые: ${ALLOWED_EXT.join(', ')}`
    }
    return null
  }

  async function upload(file: File) {
    const err = validateFile(file)
    if (err) { toast.error(err); return }

    setPhase('uploading')
    setProgress(5)
    setErrorMsg(null)

    // Fake asymptotic progress 5 → 90
    stopFakeProgress()
    progressRef.current = setInterval(() => {
      setProgress(p => p + Math.max(0.5, (90 - p) / 20))
    }, 400)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', file.name)
      const res = await fetch('/api/admin/video', { method: 'POST', body: fd })
      stopFakeProgress()

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Ошибка загрузки' }))
        setErrorMsg(error || 'Ошибка загрузки')
        setPhase('error')
        toast.error(error || 'Ошибка загрузки')
        return
      }
      const { videoId: newId } = await res.json() as { videoId: string }
      setProgress(100)
      onVideoChange(newId)
      // will transition to 'processing' via the videoId effect above
    } catch (e) {
      stopFakeProgress()
      setErrorMsg(String(e))
      setPhase('error')
      toast.error('Сетевая ошибка')
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  async function removeVideo() {
    if (!videoId) { onVideoChange(null); return }
    if (!confirm('Удалить видео с Bunny?')) return
    try {
      await fetch('/api/admin/video', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      })
    } catch {
      // ignore — still clear local reference
    }
    stopPolling()
    onVideoChange(null)
    setPhase('idle')
    setProgress(0)
    toast.success('Видео удалено')
  }

  useEffect(() => () => { stopPolling(); stopFakeProgress() }, [])

  // ─── Render ────────────────────────────
  if (phase === 'ready' && videoId && libraryId) {
    return (
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-black" style={{ aspectRatio: '16 / 9' }}>
          <iframe
            src={`https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&preload=false`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-400">video_id: {videoId}</span>
          <button
            type="button"
            onClick={removeVideo}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:border-red-300 hover:text-red-500"
          >
            🗑️ Удалить видео
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'uploading') {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[#1ec8c8] bg-gray-50 p-6 text-center">
        <div className="mb-2 text-sm font-bold text-gray-700">Загрузка видео…</div>
        <div className="mx-auto h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full transition-all"
            style={{ width: `${Math.min(100, progress)}%`, background: 'linear-gradient(90deg, #0fa8a8, #1ec8c8)' }}
          />
        </div>
        <div className="mt-2 font-mono text-xs text-gray-400">{Math.round(progress)}%</div>
      </div>
    )
  }

  if (phase === 'processing') {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[#f47920] bg-gray-50 p-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#f47920] border-t-transparent" />
          <span className="text-sm font-bold text-gray-700">Видео обрабатывается на Bunny…</span>
        </div>
        <div className="text-xs text-gray-500">Можно продолжить редактировать — статус обновится автоматически.</div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="mb-2 text-sm font-bold text-red-600">Ошибка загрузки</div>
        {errorMsg && <div className="mb-3 text-xs text-red-500">{errorMsg}</div>}
        <button
          type="button"
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:border-gray-300"
          onClick={() => { setPhase('idle'); setErrorMsg(null) }}
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  // idle
  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className="rounded-2xl border-2 border-dashed p-6 text-center transition-colors"
      style={{
        borderColor: isDragging ? '#1ec8c8' : '#e5e7eb',
        background: isDragging ? 'rgba(30,200,200,0.05)' : '#f9fafb',
      }}
    >
      <div className="mb-3 text-sm text-gray-500">
        🎬 Перетащите файл сюда или{' '}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="font-bold text-[#1ec8c8] underline-offset-2 hover:underline"
        >
          выберите
        </button>
      </div>
      <div className="text-xs text-gray-400">Макс 500MB · {ALLOWED_EXT.join(', ')}</div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXT.join(',')}
        className="hidden"
        onChange={onFileSelected}
      />
    </div>
  )
}
