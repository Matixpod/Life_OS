import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ModulePlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function ModulePlaceholder({ icon: Icon, title, description }: ModulePlaceholderProps) {
  return (
    <div className="max-w-2xl mx-auto py-12 animate-fade-in">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-muted hover:text-white text-sm mb-8"
      >
        <ArrowLeft size={14} /> Dashboard
      </Link>
      <div className="rounded-xl bg-surface border border-border p-8 md:p-10 text-center">
        <div className="size-16 mx-auto rounded-xl bg-surface2 border border-border flex items-center justify-center mb-5">
          <Icon size={32} className="text-accent-blue" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">{title}</h1>
        <p className="text-muted text-sm mb-6 max-w-md mx-auto">{description}</p>
        <span className="inline-block text-[11px] tracking-widest uppercase text-accent-amber border border-accent-amber/40 bg-accent-amber/10 rounded-full px-3 py-1">
          Coming in next update
        </span>
      </div>
    </div>
  );
}
