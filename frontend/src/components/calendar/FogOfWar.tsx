import { useState } from 'react';

interface FogOfWarProps {
  /** ISO date string (YYYY-MM-DD) representing the column's day. */
  date: string;
  children: React.ReactNode;
}

/**
 * Wraps a calendar day column with a "fog of war" effect — distant days
 * fade out, hover clears them.
 *
 * Formula: `opacity = 1 - min((daysDiff - 2) * 0.15, 0.6)`. Days within
 * the next 2 days stay at full opacity; further days fog up by 15% per
 * extra day, capped at 60%. Past days are unaffected.
 */
export default function FogOfWar({ date, children }: FogOfWarProps) {
  const [hovered, setHovered] = useState(false);

  const daysDiff = Math.floor(
    (new Date(`${date}T00:00:00Z`).getTime() -
      new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime()) /
      86_400_000,
  );
  const fog = daysDiff > 2 ? Math.min((daysDiff - 2) * 0.15, 0.6) : 0;
  const opacity = hovered ? 1 : 1 - fog;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ opacity, transition: 'opacity 200ms ease-out' }}
    >
      {children}
    </div>
  );
}
