import { redirect } from 'next/navigation'
import { getTrainerSession } from '@/lib/auth'
import TrainerHomeClient from './TrainerHomeClient'

export const dynamic = 'force-dynamic'

export default async function TrainerHomePage() {
  const session = await getTrainerSession()
  if (!session) redirect('/trainer/login')

  return (
    <TrainerHomeClient
      fullName={session.fullName}
      classLabel={session.classLabel}
    />
  )
}
