import { Clock, Crown, Leaf, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { habitsApi } from '../../api/habits';
import { projectsApi } from '../../api/projects';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useTasks } from '../../hooks/useTasks';
import type { DayPart, ProjectV2, TaskCategory, TaskPriority } from '../../types';
import { previewApCost } from '../../utils/apCost';
import HabitRecurrenceSelector, {
  type HabitRecurrenceValue,
} from '../habits/HabitRecurrenceSelector';
import DayPartTimePicker from '../ui/DayPartTimePicker';
import DurationPickerModal, { labelForMinutes } from '../ui/DurationPickerModal';
import { CATEGORIES, CATEGORY_META, PRIORITY_BORDER, PRIORITY_LABEL } from './categories';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
type AddType = 'task' | 'habit' | 'project_task';

interface Props {
  onCreated?: () => void;
  /** ISO date (YYYY-MM-DD) the new task should be scheduled for.
      Defaults to today. Used by the calendar day view to add tasks
      to past or future days. */
  defaultDate?: string;
}

/**
 * Always-visible task input bar. `N` from anywhere focuses the title input.
 * Submitting requires a category and a non-blank title; empty submit triggers
 * a shake animation. The type switcher controls whether we create a task,
 * a habit, or a project task.
 */
export default function QuickAdd({ onCreated, defaultDate }: Props = {}) {
  const tasks = useTasks();
  const [type, setType] = useState<AddType>('task');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('health');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMin, setEstimatedMin] = useState<string>('');
  const [durationMin, setDurationMin] = useState<number>(0);
  const [isRegenerative, setIsRegenerative] = useState(false);
  const [isMainQuest, setIsMainQuest] = useState(false);
  const [dayPart, setDayPart] = useState<DayPart | null>(null);
  const [recurrence, setRecurrence] = useState<HabitRecurrenceValue>({
    recurrence_type: 'daily',
    selected_days: null,
    monthly_day: null,
    custom_rule: null,
  });
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcut('n', () => inputRef.current?.focus());

  useEffect(() => {
    if (type !== 'project_task' || projects.length > 0) return;
    projectsApi
      .list('active')
      .then((list) => {
        setProjects(list);
        if (list.length > 0 && !projectId) setProjectId(list[0].id);
      })
      .catch(() => undefined);
  }, [type, projects.length, projectId]);

  const today = new Date().toISOString().slice(0, 10);
  const targetDate = defaultDate ?? today;

  const hasMainQuestToday = useMemo(
    () => Boolean(tasks.today?.tasks.some((t) => t.is_main_quest && t.status !== 'skipped')),
    [tasks.today],
  );

  async function submit(): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (type === 'task') {
        const minutes =
          durationMin > 0 ? Math.max(5, Math.min(480, durationMin)) : null;
        await tasks.createTask({
          title: trimmed,
          category,
          priority,
          scheduled_date: targetDate,
          estimated_minutes: minutes,
          is_main_quest: isMainQuest,
          is_regenerative: isRegenerative,
          day_part: dayPart,
        });
      } else if (type === 'habit') {
        await habitsApi.create({
          title: trimmed,
          category,
          priority,
          recurrence_type: recurrence.recurrence_type,
          selected_days: recurrence.selected_days,
          monthly_day: recurrence.monthly_day,
          custom_rule: recurrence.custom_rule,
          day_part: dayPart,
        });
      } else {
        if (!projectId) {
          setError('Wybierz projekt.');
          setSubmitting(false);
          return;
        }
        await projectsApi.createTask(projectId, {
          title: trimmed,
          priority,
          estimated_minutes: estimatedMin
            ? Math.max(1, Math.min(600, Number(estimatedMin)))
            : null,
        });
      }
      setTitle('');
      setEstimatedMin('');
      setDurationMin(0);
      setIsRegenerative(false);
      setIsMainQuest(false);
      setDayPart(null);
      onCreated?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-surface2 p-0.5">
          {(['task', 'habit', 'project_task'] as AddType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-2.5 py-1 text-[11px] rounded-sm transition-colors ${
                type === t ? 'bg-surface text-white' : 'text-muted hover:text-white'
              }`}
            >
              {t === 'task' ? 'Zadanie' : t === 'habit' ? 'Habit' : 'Projekt'}
            </button>
          ))}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
            if (e.key === 'Escape') {
              setTitle('');
              setEstimatedMin('');
              inputRef.current?.blur();
            }
          }}
          placeholder={
            defaultDate && defaultDate !== today
              ? `Dodaj do ${targetDate}…`
              : 'Dodaj… (N aby zaznaczyć)'
          }
          aria-label="New title"
          className={`flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm placeholder:text-muted py-2 px-2 rounded-md ${
            shake ? 'animate-shake border border-accent-red/60' : ''
          }`}
        />
        {type === 'project_task' && (
          <input
            type="number"
            min={5}
            max={480}
            step={5}
            value={estimatedMin}
            onChange={(e) => setEstimatedMin(e.target.value)}
            placeholder="min"
            aria-label="Estimated minutes"
            className="w-16 bg-surface2 border border-border rounded-md px-2 py-1.5 text-xs font-mono text-center placeholder:text-muted focus:outline-none focus:border-accent-blue"
          />
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-accent-blue/15 border border-accent-blue/40 hover:bg-accent-blue/25 text-accent-blue px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          <Plus size={14} /> Dodaj
        </button>
      </div>

      {type !== 'project_task' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            const Icon = meta.icon;
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: `${meta.color}25`,
                        borderColor: `${meta.color}80`,
                        color: meta.color,
                      }
                    : { backgroundColor: 'transparent', borderColor: '#262636', color: '#8B8B9F' }
                }
              >
                <Icon size={12} />
                {meta.label}
              </button>
            );
          })}

          <span className="mx-1 h-4 w-px bg-border" />

          {PRIORITIES.map((p) => {
            const active = priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={active}
                className="font-mono text-[11px] rounded-full size-7 flex items-center justify-center border transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: `${PRIORITY_BORDER[p]}25`,
                        borderColor: `${PRIORITY_BORDER[p]}80`,
                        color: PRIORITY_BORDER[p],
                      }
                    : { backgroundColor: 'transparent', borderColor: '#262636', color: '#8B8B9F' }
                }
              >
                {PRIORITY_LABEL[p]}
              </button>
            );
          })}
        </div>
      )}

      {type === 'task' && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors ${
              durationMin > 0
                ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                : 'border-border bg-transparent text-muted hover:text-white'
            }`}
          >
            <Clock size={11} /> Czas: {durationMin > 0 ? labelForMinutes(durationMin) : '—'}
          </button>
          <button
            type="button"
            onClick={() => setIsRegenerative((v) => !v)}
            aria-pressed={isRegenerative}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors ${
              isRegenerative
                ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                : 'border-border bg-transparent text-muted hover:text-white'
            }`}
          >
            <Leaf size={11} /> Regeneratywne
          </button>
          <button
            type="button"
            onClick={() => {
              if (hasMainQuestToday && !isMainQuest) return;
              setIsMainQuest((v) => !v);
            }}
            disabled={hasMainQuestToday && !isMainQuest}
            aria-pressed={isMainQuest}
            title={
              hasMainQuestToday && !isMainQuest
                ? 'Główny quest jest już ustawiony na dziś'
                : undefined
            }
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              isMainQuest
                ? 'border-amber-300/70 bg-amber-300/15 text-amber-200'
                : 'border-border bg-transparent text-muted hover:text-white'
            }`}
          >
            <Crown size={11} /> Główny Quest
          </button>
          {durationMin > 0 && (
            <span
              className={`font-mono ${
                isRegenerative ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {isRegenerative
                ? `Zwrot: +${previewApCost(durationMin, priority, true)} AP`
                : `Koszt: -${previewApCost(durationMin, priority, false)} AP`}
            </span>
          )}
        </div>
      )}

      {(type === 'task' || type === 'habit') && (
        <DayPartTimePicker dayPart={dayPart} onChange={setDayPart} />
      )}

      {type === 'habit' && (
        <HabitRecurrenceSelector value={recurrence} onChange={setRecurrence} />
      )}

      {type === 'project_task' && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Projekt:</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-border bg-surface2 px-2 py-1 text-xs focus:border-accent-blue focus:outline-none"
          >
            {projects.length === 0 && <option value="">Brak aktywnych projektów</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <span className="ml-2 inline-flex gap-1">
            {PRIORITIES.map((p) => {
              const active = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className="font-mono text-[11px] rounded-full size-6 flex items-center justify-center border"
                  style={
                    active
                      ? {
                          backgroundColor: `${PRIORITY_BORDER[p]}25`,
                          borderColor: `${PRIORITY_BORDER[p]}80`,
                          color: PRIORITY_BORDER[p],
                        }
                      : {
                          backgroundColor: 'transparent',
                          borderColor: '#262636',
                          color: '#8B8B9F',
                        }
                  }
                >
                  {PRIORITY_LABEL[p]}
                </button>
              );
            })}
          </span>
        </div>
      )}

      {error && <div className="text-[11px] text-accent-red">{error}</div>}

      <DurationPickerModal
        open={pickerOpen}
        value={durationMin}
        onChange={(m) => {
          setDurationMin(m);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
