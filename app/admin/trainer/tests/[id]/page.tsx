import TrainerTestEditor from '../TrainerTestEditor'

interface PageProps {
  params: { id: string }
}

export default function TrainerTestEditPage({ params }: PageProps) {
  return <TrainerTestEditor mode="edit" testId={params.id} />
}
