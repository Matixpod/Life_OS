import { Moon } from 'lucide-react';
import ModulePlaceholder from '../components/ModulePlaceholder';

export default function Sleep() {
  return (
    <ModulePlaceholder
      icon={Moon}
      title="Sleep & Energy"
      description="Sleep duration, quality, and morning mood — logged via the morning popup."
    />
  );
}
