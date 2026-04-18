'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type ToastKind = 'success' | 'error'
type ToastItem = { id: number; kind: ToastKind; message: string }

type ToastFns = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastCtx = createContext<ToastFns | null>(null)

export function useToast(): { toast: ToastFns } {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return { toast: ctx }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setItems(prev => [...prev, { id, kind, message }])
    setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const api: ToastFns = {
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {items.map(t => (
          <ToastBubble key={t.id} kind={t.kind} message={t.message} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

function ToastBubble({ kind, message }: { kind: ToastKind; message: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const a = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(a)
  }, [])

  const bg = kind === 'success'
    ? 'linear-gradient(135deg, #0fa8a8, #1ec8c8)'
    : 'linear-gradient(135deg, #d4145a, #f47920)'

  return (
    <div
      className="pointer-events-auto min-w-[220px] max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg transition-all"
      style={{
        background: bg,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        opacity: visible ? 1 : 0,
      }}
    >
      {kind === 'success' ? '✅ ' : '⚠️ '}{message}
    </div>
  )
}
