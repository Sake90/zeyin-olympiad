'use client'

import { useState } from 'react'

export function Collapsible({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string
  icon?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-base font-bold text-gray-800">{title}</span>
        </div>
        <span
          className="text-gray-400 transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▶
        </span>
      </button>
      {open && <div className="border-t border-gray-100 p-5">{children}</div>}
    </div>
  )
}
