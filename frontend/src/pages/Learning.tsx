import { BookOpen } from 'lucide-react';
import ModulePlaceholder from '../components/ModulePlaceholder';

export default function Learning() {
  return (
    <ModulePlaceholder
      icon={BookOpen}
      title="Learning"
      description="Books, podcasts, courses, articles, and videos — with AI-generated comprehension quizzes."
    />
  );
}
