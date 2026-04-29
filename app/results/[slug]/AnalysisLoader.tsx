'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const POLL_MS = 1500
const MAX_ATTEMPTS = 20   // ~30s total

interface Props {
  slug: string
}

// Polls the analysis endpoint until ready, then triggers a server-component
// refresh so the parent page picks up the persisted analysis from the DB.
export default function AnalysisLoader({ slug }: Props) {
  const router = useRouter()
  const stopped = useRef(false)

  useEffect(() => {
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      if (stopped.current) return
      attempts += 1
      try {
        const r = await fetch(`/api/results/${encodeURIComponent(slug)}/analysis`, {
          cache: 'no-store',
        })
        if (r.ok) {
          const body = await r.json() as { ready?: boolean }
          if (body.ready) {
            // Analysis is in the DB now — re-render the server component.
            stopped.current = true
            router.refresh()
            return
          }
        }
      } catch {
        // ignore network blips — keep polling
      }
      if (attempts < MAX_ATTEMPTS) {
        timer = setTimeout(tick, POLL_MS)
      }
    }

    tick()
    return () => {
      stopped.current = true
      if (timer) clearTimeout(timer)
    }
  }, [slug, router])

  return null
}
