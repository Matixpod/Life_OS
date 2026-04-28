import { User } from 'lucide-react';
import ModulePlaceholder from '../components/ModulePlaceholder';

export default function Profile() {
  return (
    <ModulePlaceholder
      icon={User}
      title="Profile"
      description="Your user profile, streak history, and system start date."
    />
  );
}
