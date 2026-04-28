import {
  Activity,
  Apple,
  BookOpen,
  Brain,
  Dumbbell,
  Heart,
  LayoutGrid,
  Library,
  Moon,
  Newspaper,
  Pill,
  Plus,
  Target,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MODULES = [
  { to: '/goals', icon: Target, label: 'Goal' },
  { to: '/sleep', icon: Moon, label: 'Sleep' },
  { to: '/supplements', icon: Pill, label: 'Supplement' },
  { to: '/workout', icon: Dumbbell, label: 'Workout' },
  { to: '/cognitive', icon: Brain, label: 'Challenge' },
  { to: '/mental-health', icon: Heart, label: 'Mood' },
  { to: '/body', icon: Activity, label: 'Body' },
  { to: '/nutrition', icon: Apple, label: 'Meal' },
  { to: '/deep-work', icon: LayoutGrid, label: 'Deep Work' },
  { to: '/learning', icon: BookOpen, label: 'Learning' },
  { to: '/intelligence', icon: Newspaper, label: 'Intel' },
  { to: '/review', icon: Library, label: 'Review' },
];

export default function QuickAddFAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        aria-label="Quick add"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-6 z-30 size-14 rounded-full bg-accent-blue text-white shadow-xl shadow-accent-blue/30 hover:scale-105 transition-transform flex items-center justify-center"
      >
        <Plus size={24} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl border border-border w-full max-w-2xl p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] tracking-widest uppercase text-muted">Quick add</div>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {MODULES.map((m) => (
                <button
                  key={m.to}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(m.to);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface2 border border-border hover:border-accent-blue/40 transition-colors"
                >
                  <m.icon size={22} className="text-accent-blue" />
                  <span className="text-xs">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
