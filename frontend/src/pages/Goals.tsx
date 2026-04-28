import { Target } from 'lucide-react';
import ModulePlaceholder from '../components/ModulePlaceholder';

export default function Goals() {
  return (
    <ModulePlaceholder
      icon={Target}
      title="Goals"
      description="Daily goal list with completion tracking. Future: Google Calendar sync."
    />
  );
}
