import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import MobileNav from '../components/MobileNav';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { api } from '../services/api';
import type { UserProfile } from '../types';

export default function DashboardLayout() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    api.getUserProfile().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <div className="h-full flex bg-bg text-white">
      <Sidebar streakDays={user?.current_streak_days ?? 0} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar userName={user?.name} />
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-20 md:pb-6">
          <Outlet />
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
