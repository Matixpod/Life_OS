import { Pill } from 'lucide-react';
import ModulePlaceholder from '../components/ModulePlaceholder';

export default function Supplements() {
  return (
    <ModulePlaceholder
      icon={Pill}
      title="Supplements"
      description="Daily checklist of active supplements with morning/afternoon/evening grouping."
    />
  );
}
