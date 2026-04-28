import { Brain, Home, Library, Moon, Newspaper } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/sleep', icon: Moon, label: 'Sleep' },
  { to: '/cognitive', icon: Brain, label: 'Mind' },
  { to: '/intelligence', icon: Newspaper, label: 'News' },
  { to: '/review', icon: Library, label: 'Review' },
];

export default function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border z-20">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 text-[10px] ${
                  isActive ? 'text-accent-blue' : 'text-muted'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
