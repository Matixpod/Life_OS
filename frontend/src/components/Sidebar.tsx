import {
  Activity,
  Apple,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  FolderKanban,
  Heart,
  Home,
  LayoutGrid,
  Library,
  Moon,
  Newspaper,
  Pill,
  Repeat2,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'PLAN',
    items: [
      { to: '/', icon: Home, label: 'Dashboard' },
      { to: '/calendar', icon: CalendarDays, label: 'Kalendarz' },
      { to: '/habits', icon: Repeat2, label: 'Habity' },
      { to: '/projects', icon: FolderKanban, label: 'Projekty' },
    ],
  },
  {
    title: 'DAILY',
    items: [
      { to: '/sleep', icon: Moon, label: 'Sleep & Energy' },
      { to: '/supplements', icon: Pill, label: 'Supplements' },
    ],
  },
  {
    title: 'TRACKING',
    items: [
      { to: '/workout', icon: Dumbbell, label: 'Workout' },
      { to: '/cognitive', icon: Brain, label: 'Cognitive' },
      { to: '/mental-health', icon: Heart, label: 'Mental Health' },
      { to: '/body', icon: Activity, label: 'Body Metrics' },
      { to: '/nutrition', icon: Apple, label: 'Nutrition' },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { to: '/deep-work', icon: LayoutGrid, label: 'Deep Work' },
      { to: '/learning', icon: BookOpen, label: 'Learning' },
      { to: '/intelligence', icon: Newspaper, label: 'Intelligence' },
      { to: '/review', icon: Library, label: 'Review' },
      { to: '/kronos', icon: ShieldCheck, label: 'KRONOS' },
      { to: '/ares', icon: Heart, label: 'ARES' },
    ],
  },
  {
    title: 'YOU',
    items: [
      { to: '/profile', icon: User, label: 'Profile' },
      { to: '/settings/ai', icon: Settings, label: 'AI Settings' },
    ],
  },
];

interface SidebarProps {
  streakDays: number;
}

export default function Sidebar({ streakDays }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-60'} hidden md:flex shrink-0 flex-col bg-surface border-r border-border transition-all duration-200`}
    >
      <div className="flex items-center justify-between p-4">
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center w-full' : ''}`}>
          <div className="size-8 rounded-md bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          {!collapsed && <span className="font-semibold tracking-tight">Life OS</span>}
        </div>
        <button
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <div className="px-3 pt-2 pb-1 text-[10px] tracking-widest text-muted">
                {section.title}
              </div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 mb-0.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-surface2 text-white border-l-2 border-accent-blue'
                      : 'text-muted hover:bg-surface2 hover:text-white'
                  }`
                }
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div
          className={`flex items-center gap-2 rounded-md bg-surface2 px-3 py-2 ${collapsed ? 'justify-center' : ''}`}
        >
          <Flame size={18} className="text-accent-amber shrink-0" />
          {!collapsed && (
            <div className="flex-1">
              <div className="font-mono text-sm">{streakDays}</div>
              <div className="text-[10px] text-muted">day streak</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
