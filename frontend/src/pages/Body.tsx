import { Activity } from 'lucide-react';
import ModulePlaceholder from '../components/ModulePlaceholder';

export default function Body() {
  return (
    <ModulePlaceholder
      icon={Activity}
      title="Body Metrics"
      description="Weight, body fat, water, muscle, and BMI — tracked over time."
    />
  );
}
