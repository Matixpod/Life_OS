import { Dumbbell } from 'lucide-react';
import ModulePlaceholder from '../components/ModulePlaceholder';

export default function Workout() {
  return (
    <ModulePlaceholder
      icon={Dumbbell}
      title="Workout"
      description="Strength, cardio, flexibility, and sport sessions with muscle-group tracking."
    />
  );
}
