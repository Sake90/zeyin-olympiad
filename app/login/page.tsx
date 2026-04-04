export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const db = createServiceClient()
  const { data } = await db
    .from('olympiads')
    .select('name_ru, name_kz')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) {
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

  return <LoginClient name_ru={data.name_ru} name_kz={data.name_kz} />
}
