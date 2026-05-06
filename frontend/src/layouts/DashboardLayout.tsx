import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import DailyBriefingModal from '../components/daily/DailyBriefingModal';
import StaminaDetailsPanel from '../components/daily/StaminaDetailsPanel';
import MobileNav from '../components/MobileNav';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import FloatingCombatText from '../components/ui/FloatingCombatText';
import { useDailyInit } from '../hooks/useDailyInit';
import { useStamina } from '../hooks/useStamina';
import { api } from '../services/api';
import type { UserProfile } from '../types';

export default function DashboardLayout() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [staminaPanelOpen, setStaminaPanelOpen] = useState(false);
  const daily = useDailyInit();
  const stamina = useStamina();

  useEffect(() => {
    api.getUserProfile().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <div className="h-full flex bg-bg text-white">
      <Sidebar streakDays={user?.current_streak_days ?? 0} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userName={user?.name}
          stamina={stamina.status}
          staminaLoading={stamina.isLoading}
          onOpenStamina={() => setStaminaPanelOpen(true)}
        />
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-20 md:pb-6">
          <Outlet />
        </main>
        <MobileNav />
      </div>
      {daily.needsBriefing && (
        <DailyBriefingModal
          onComplete={(log) => {
            daily.setLog(log);
            void stamina.refresh();
          }}
        />
      )}
      <StaminaDetailsPanel
        open={staminaPanelOpen}
        status={stamina.status}
        boosts={stamina.boosts}
        onClose={() => setStaminaPanelOpen(false)}
        onChange={() => void stamina.refresh()}
      />
      <FloatingCombatText />
    </div>
  );
}
