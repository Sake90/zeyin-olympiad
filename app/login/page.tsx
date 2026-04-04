export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  let data = null
  try {
    const db = createServiceClient()
    const result = await db
      .from('olympiads')
      .select('name_ru, name_kz, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    console.log('[login] supabase result:', JSON.stringify({ data: result.data, error: result.error }))
    data = result.data
  } catch (err) {
    console.error('[login] supabase threw:', err)
  }

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
