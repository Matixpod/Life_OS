import { useParams } from 'react-router-dom';
import ProjectDetailView from '../components/projects/ProjectDetail';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <ProjectDetailView projectId={id} />
    </div>
  );
}
