import { Heart } from 'lucide-react';
import ModulePlaceholder from '../components/ModulePlaceholder';

export default function MentalHealth() {
  return (
    <ModulePlaceholder
      icon={Heart}
      title="Mental Health"
      description="Mood, energy, stress check-ins and a private journal with semantic search."
    />
  );
}
