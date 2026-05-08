import { AlertTriangle, Check, ChevronDown, ChevronUp, Save, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { prometheusApi } from '../../../api/prometheus';
import type { CardioProfile } from '../../../types/prometheus';

interface Props {
  profile: CardioProfile | null;
  onSave: (p: CardioProfile) => void;
  forceOpen?: boolean;
}

export default function CardioProfileForm({ profile, onSave, forceOpen }: Props) {
  const [open, setOpen] = useState<boolean>(!profile);
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender ?? 'male');
  const [weightKg, setWeightKg] = useState<string>(profile?.weight_kg?.toString() ?? '');
  const [age, setAge] = useState<string>(profile?.age?.toString() ?? '');
  const [vo2max, setVo2max] = useState<string>(profile?.vo2max?.toString() ?? '');
  const [bodyFatPct, setBodyFatPct] = useState<string>(profile?.body_fat_pct?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!profile) return;
    setGender(profile.gender);
    setWeightKg(profile.weight_kg.toString());
    setAge(profile.age.toString());
    setVo2max(profile.vo2max?.toString() ?? '');
    setBodyFatPct(profile.body_fat_pct?.toString() ?? '');
  }, [profile]);

  const canSave = weightKg.trim() !== '' && age.trim() !== '' && Number(weightKg) > 0 && Number(age) > 0;

  async function save(): Promise<void> {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload: CardioProfile = {
        gender,
        weight_kg: Number(weightKg),
        age: Number(age),
        ...(vo2max.trim() ? { vo2max: Number(vo2max) } : {}),
        ...(bodyFatPct.trim() ? { body_fat_pct: Number(bodyFatPct) } : {}),
      };
      const saved = await prometheusApi.upsertCardioProfile(payload);
      onSave(saved);
      setSavedFlash(true);
      setOpen(false);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać profilu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
          <Settings2 size={14} className="text-accent-orange" /> Profil cardio
          {profile && (
            <span className="ml-2 text-[11px] font-mono text-muted">
              {profile.gender === 'male' ? '👨' : '👩'} {profile.weight_kg} kg · {profile.age} lat
            </span>
          )}
        </span>
        <span className="inline-flex items-center gap-2">
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-[11px] text-accent-green">
              <Check size={12} /> Zapisano
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
        </span>
      </button>

      {!profile && (
        <div className="mx-4 mb-2 inline-flex items-center gap-2 rounded-md border border-accent-orange/40 bg-accent-orange/10 px-3 py-2 text-[11px] text-accent-orange">
          <AlertTriangle size={12} /> Ustaw profil dla dokładnych wyliczeń kalorii.
        </div>
      )}

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted">Płeć</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['male', 'female'] as const).map((g) => {
                const active = gender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    aria-pressed={active}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'border-accent-orange bg-surface2 text-white'
                        : 'border-border bg-transparent text-muted hover:text-white'
                    }`}
                  >
                    {g === 'male' ? '👨 Mężczyzna' : '👩 Kobieta'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Waga"
              suffix="kg"
              value={weightKg}
              onChange={setWeightKg}
              step={0.5}
              min={20}
              max={300}
              required
            />
            <NumberField
              label="Wiek"
              suffix="lat"
              value={age}
              onChange={setAge}
              step={1}
              min={10}
              max={120}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="VO₂ max"
              suffix="ml/kg/min"
              value={vo2max}
              onChange={setVo2max}
              step={0.1}
              min={10}
              max={90}
              placeholder="np. 45"
              hint="Opcjonalne — zwiększa dokładność obliczeń"
            />
            <NumberField
              label="% tkanki tłuszczowej"
              suffix="%"
              value={bodyFatPct}
              onChange={setBodyFatPct}
              step={0.1}
              min={2}
              max={60}
              hint="Opcjonalne — zwiększa dokładność obliczeń"
            />
          </div>

          {error && (
            <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={!canSave || saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-orange px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Zapisuję…' : 'Zapisz profil'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  step,
  min,
  max,
  required,
  placeholder,
  hint,
}: NumberFieldProps) {
  return (
    <div>
      <label className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-widest text-muted">{label}</span>
        <span className="text-[10px] text-muted">{suffix}</span>
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-sm text-white focus:border-accent-orange focus:outline-none"
      />
      {hint && <div className="mt-1 text-[10px] text-muted">{hint}</div>}
    </div>
  );
}
