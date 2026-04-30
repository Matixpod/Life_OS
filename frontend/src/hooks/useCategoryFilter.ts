import { useEffect, useState } from 'react';
import { CATEGORIES } from '../components/tasks/categories';
import type { TaskCategory } from '../types';

const STORAGE_KEY = 'tasks.categoryFilter';

export type CategoryFilterValue = TaskCategory | 'all';

export function useCategoryFilter(): [CategoryFilterValue, (v: CategoryFilterValue) => void] {
  const [value, setValue] = useState<CategoryFilterValue>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'all') return 'all';
      if (raw && (CATEGORIES as string[]).includes(raw)) return raw as TaskCategory;
    } catch {
      /* ignore */
    }
    return 'all';
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, [value]);
  return [value, setValue];
}
