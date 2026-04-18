import { NextRequest, NextResponse } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BUNNY_BASE = 'https://video.bunnycdn.com/library'
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB
const ALLOWED_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm']

function env() {
  const libraryId = process.env.BUNNY_LIBRARY_ID
  const apiKey = process.env.BUNNY_API_KEY
  if (!libraryId || !apiKey) {
    throw new Error('BUNNY_LIBRARY_ID и BUNNY_API_KEY должны быть заданы в .env.local')
  }
  return { libraryId, apiKey }
}

// POST — upload video
export async function POST(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { libraryId, apiKey } = env()
    const form = await req.formData()
    const file = form.get('file')
    const rawTitle = form.get('title')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Файл больше 500MB' }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    if (!ALLOWED_EXT.some(ext => name.endsWith(ext))) {
      return NextResponse.json(
        { error: `Формат не поддерживается. Допустимые: ${ALLOWED_EXT.join(', ')}` },
        { status: 400 },
      )
    }

    const title = (typeof rawTitle === 'string' && rawTitle.trim()) || file.name

    // Step 1: create video entry
    const createRes = await fetch(`${BUNNY_BASE}/${libraryId}/videos`, {
      method: 'POST',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ title }),
    })
    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => '')
      console.error('[bunny create]', createRes.status, txt)
      return NextResponse.json(
        { error: `Bunny create failed: ${createRes.status}` },
        { status: 502 },
      )
    }
    const created = await createRes.json() as { guid: string }
    const videoId = created.guid

    // Step 2: upload bytes
    const buf = Buffer.from(await file.arrayBuffer())
    const uploadRes = await fetch(`${BUNNY_BASE}/${libraryId}/videos/${videoId}`, {
      method: 'PUT',
      headers: { AccessKey: apiKey },
      body: buf,
    })
    if (!uploadRes.ok) {
      const txt = await uploadRes.text().catch(() => '')
      console.error('[bunny upload]', uploadRes.status, txt)
      return NextResponse.json(
        { error: `Bunny upload failed: ${uploadRes.status}` },
        { status: 502 },
      )
    }

    return NextResponse.json({ videoId, title }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/admin/video]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET — status polling
export async function GET(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const videoId = req.nextUrl.searchParams.get('videoId')
    if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

    const { libraryId, apiKey } = env()
    const res = await fetch(`${BUNNY_BASE}/${libraryId}/videos/${videoId}`, {
      headers: { AccessKey: apiKey, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Bunny status failed: ${res.status}` },
        { status: 502 },
      )
    }
    const data = await res.json() as {
      status: number
      length?: number
      thumbnailFileName?: string
    }
    return NextResponse.json({
      status: data.status,
      length: data.length ?? 0,
      thumbnailFileName: data.thumbnailFileName ?? null,
    })
  } catch (e) {
    console.error('[GET /api/admin/video]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE — remove video
export async function DELETE(req: NextRequest) {
  try {
    if (!(await getAdminSessionFromRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({})) as { videoId?: string }
    const videoId = body.videoId ?? req.nextUrl.searchParams.get('videoId')
    if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

    const { libraryId, apiKey } = env()
    const res = await fetch(`${BUNNY_BASE}/${libraryId}/videos/${videoId}`, {
      method: 'DELETE',
      headers: { AccessKey: apiKey, Accept: 'application/json' },
    })
    if (!res.ok && res.status !== 404) {
      const txt = await res.text().catch(() => '')
      console.error('[bunny delete]', res.status, txt)
      return NextResponse.json(
        { error: `Bunny delete failed: ${res.status}` },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/admin/video]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
