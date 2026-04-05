export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const db = createServiceClient()
  const { data } = await db
    .from('olympiads')
    .select('id, name_ru, name_kz')
    .in('status', ['active', 'registration'])
    .order('created_at', { ascending: false })

  const olympiads = data ?? []

  if (olympiads.length === 0) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
      }}>
        <p style={{ fontSize: 20, color: '#888', fontFamily: 'sans-serif' }}>
          Скоро открытие
        </p>
      </div>
    )
  }

  return <LoginClient olympiads={olympiads} />
}
