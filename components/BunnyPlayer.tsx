'use client'

export function BunnyPlayer({ videoId, title }: { videoId: string; title?: string }) {
  const libraryId = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID
  if (!libraryId) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        NEXT_PUBLIC_BUNNY_LIBRARY_ID не задан
      </div>
    )
  }

  const src = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&preload=true`

  return (
    <div
      onContextMenu={e => e.preventDefault()}
      className="relative w-full overflow-hidden rounded-2xl bg-black"
      style={{ aspectRatio: '16 / 9' }}
    >
      <iframe
        src={src}
        title={title ?? 'Видео'}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

export default BunnyPlayer
