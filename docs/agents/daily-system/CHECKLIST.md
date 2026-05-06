# ✅ DAILY SYSTEM — Implementation Checklist

## 🏗️ Phase 1: Database
- [ ] Create `migrations/009_daily_system.sql`
  - [ ] `daily_logs` table (sleep_score, energy_score, stamina_pool, UNIQUE per day)
  - [ ] `stamina_boosts` table (boost_type enum check, ap_restored, used_at)
  - [ ] ALTER `daily_tasks`: add estimated_minutes, ap_cost (generated), is_main_quest, is_regenerative
  - [ ] ALTER `project_tasks`: add estimated_minutes
  - [ ] ALTER `habits`: add estimated_minutes
  - [ ] UNIQUE INDEX on is_main_quest=true per (user_id, scheduled_date)
  - [ ] RLS + owner policies on daily_logs, stamina_boosts
  - [ ] Indexes on (user_id, date) for both new tables
- [ ] Run migration — verify all columns exist
- [ ] Verify existing daily_tasks records unaffected (new columns nullable/defaulted)

## 🧱 Phase 2: Backend Models
- [ ] Create `/app/models/daily_system_models.py`
  - [ ] `BoostType` enum (coffee, power_nap, nap, walk, water, meditation)
  - [ ] `DailyLog` model
  - [ ] `DailyLogCreate` model (sleep_score, energy_score validators 0-100)
  - [ ] `StaminaStatus` model (base_pool, boosts_total, ap_used, ap_restored, ap_available, percentage)
  - [ ] `TaskAPItem` model
  - [ ] `BoostAvailability` model (is_available, cooldown_remaining_min, uses_today)
  - [ ] `BoostResult` model (new_ap_available, cooldown_until)
- [ ] Update `/app/models/task_models.py`
  - [ ] Add `estimated_minutes: int | None` to TaskCreate
  - [ ] Add `is_main_quest: bool = False` to TaskCreate
  - [ ] Add `is_regenerative: bool = False` to TaskCreate
  - [ ] Add these fields to Task model

## ⚙️ Phase 3: Daily Log Service
- [ ] Create `/app/services/daily_log_service.py`
- [ ] `BOOST_CONFIG` dict with all 6 boosts (ap, cooldown_hours, max_per_day)
- [ ] `compute_stamina_pool(sleep, energy) -> int`
  - [ ] Formula: `int(((sleep + energy) / 2) * 6)`
  - [ ] Floor at 0, ceil at 600
- [ ] `create_daily_log(user_id, sleep_score, energy_score) -> DailyLog`
  - [ ] Upsert — update if already exists for today
  - [ ] Compute and store stamina_pool
- [ ] `get_today_log(user_id) -> DailyLog | None`
- [ ] `get_stamina_status(user_id, date) -> StaminaStatus`
  - [ ] Fetch daily_log for date
  - [ ] Sum boosts for date from stamina_boosts
  - [ ] Sum estimated_minutes of completed non-regenerative tasks (ap_used)
  - [ ] Sum estimated_minutes of completed regenerative tasks (ap_restored)
  - [ ] Compute ap_available = base + boosts - used + restored (floor at 0)
  - [ ] Return is_initialized=false if no daily_log
- [ ] `get_boost_availability(user_id, date) -> list[BoostAvailability]`
  - [ ] For each boost type:
    - [ ] Find last use timestamp today
    - [ ] Check cooldown_hours elapsed
    - [ ] Count uses today vs max_per_day
    - [ ] Return cooldown_remaining_min
- [ ] `use_boost(user_id, boost_type) -> BoostResult`
  - [ ] Check availability → raise 429 if on cooldown or max reached
  - [ ] Insert stamina_boosts record
  - [ ] Return new StaminaStatus
- [ ] `get_history(user_id, days=14) -> list[DailyLog]`

## 🔗 Phase 4: API Routes
- [ ] Create `/app/routers/daily_system.py`
- [ ] `POST /api/v1/daily/log` → create/upsert today's log
- [ ] `GET /api/v1/daily/log` → today's log or null
- [ ] `GET /api/v1/daily/log/{date}` → specific date log
- [ ] `GET /api/v1/daily/stamina` → full StaminaStatus
- [ ] `GET /api/v1/daily/boosts` → all boost availabilities
- [ ] `POST /api/v1/daily/boosts/{boost_type}` → use boost (429 on cooldown)
- [ ] `GET /api/v1/daily/history` → last 14 days
- [ ] Register router in `main.py`
- [ ] All routes use `get_current_user`

## 🧪 Phase 5: Backend Tests
- [ ] `test_daily_log_service.py`
  - [ ] `compute_stamina_pool(100, 100)` = 600
  - [ ] `compute_stamina_pool(70, 70)` = 420
  - [ ] `compute_stamina_pool(0, 0)` = 0
  - [ ] Upsert: create log, create again for same day → updates, not duplicates
  - [ ] `get_stamina_status` with no tasks = base_pool
  - [ ] `get_stamina_status` with completed tasks = base - ap_used
  - [ ] `get_stamina_status` with regenerative task = base + ap_restored
  - [ ] Boost on cooldown → raises 429
  - [ ] Boost max_per_day reached → raises 429
  - [ ] Coffee max 2x: 1st ok, 2nd ok, 3rd → 429

## 🎨 Phase 6: Frontend — DailyBriefingModal
- [ ] Create `/src/components/daily/DailyBriefingModal.tsx`
  - [ ] Full-screen overlay (backdrop-blur)
  - [ ] Two custom range sliders (sleep + energy)
  - [ ] Slider color: CSS gradient red→amber→emerald based on value
  - [ ] Stamina preview: real-time calculation as sliders move
  - [ ] Stamina shown as "X min (~Xh Ym)"
  - [ ] "Inicjalizuj Dzień" button — disabled until both sliders touched
  - [ ] Fade + scale-up animation on mount
  - [ ] Fade + scale-down animation on submit
  - [ ] POST /api/v1/daily/log on submit
- [ ] Logic: show modal on app load if GET /api/v1/daily/log returns null
- [ ] `/src/hooks/useDailyInit.ts` — checks initialization state on app load

## 🎨 Phase 7: Frontend — DurationPicker
- [ ] Create `/src/components/ui/DurationPicker.tsx`
  - [ ] Two-column drum-roll layout
  - [ ] Hours column: 0–12 (scrollable, CSS scroll-snap)
  - [ ] Minutes column: 0, 5, 10, ..., 55 (12 items, scrollable)
  - [ ] Center item = selected (large, full opacity)
  - [ ] Items above/below = smaller (0.85x) + semi-transparent (opacity 0.4)
  - [ ] Smooth scroll-snap: `scroll-snap-type: y mandatory`
  - [ ] `onChange(totalMinutes: number)` callback
  - [ ] AP cost preview below: "Koszt: -90 AP" (red) or "Zwrot: +15 AP" (green)
  - [ ] When totalMinutes = 0: show "Bez limitu" (no AP contribution)
- [ ] Integrate into QuickAdd.tsx
- [ ] Integrate into task edit form

## 🎨 Phase 8: Frontend — Stamina Bar & Details
- [ ] Create `/src/components/daily/StaminaBar.tsx`
  - [ ] Progress bar with colored fill (green/amber/red thresholds)
  - [ ] Text: "X / Y min"
  - [ ] Pulsing animation when < 20%
  - [ ] Animated transitions on value change
  - [ ] Click → opens StaminaDetailsPanel
  - [ ] Place in top navigation bar
- [ ] Create `/src/components/daily/StaminaDetailsPanel.tsx`
  - [ ] Slide-in from right (not modal)
  - [ ] Stamina breakdown: base, boosts, used, restored, available
  - [ ] Time format: "Xh Ym" when >= 60 min
  - [ ] Boost buttons grid (2 columns)
  - [ ] Available boost: colored, shows "+X AP"
  - [ ] Cooldown boost: gray, shows "Xh Xm" countdown
  - [ ] Max reached: gray, shows "Limit dzienny"
  - [ ] Task AP breakdown list
  - [ ] Countdown timer: setInterval updates every 60s
- [ ] Create `/src/api/dailySystem.ts` — typed API client
- [ ] Create `/src/hooks/useStamina.ts` — fetches and manages stamina state

## 🎨 Phase 9: Frontend — QuestCard
- [ ] Create `/src/components/tasks/QuestCard.tsx` (replaces/extends TaskCard)
  - [ ] Colored left border (category color)
  - [ ] AP cost badge: "-90 AP" red, "+15 AP" green for regenerative
  - [ ] XP reward badge: "+75 XP" gold
  - [ ] Main Quest: gold border glow + 👑 crown icon
  - [ ] Decay state (overdue): CSS diagonal stripe overlay
  - [ ] Over-stamina state: red tinted background
  - [ ] Completed state: strikethrough, muted, checkmark
  - [ ] Sound on complete: Web Audio API chime (C5, 150ms)
- [ ] Create `/src/components/tasks/StaminaCutoffLine.tsx`
  - [ ] `computeCutoff(tasks, staminaPool)` function
  - [ ] Red dashed horizontal line between cards
  - [ ] Label: "⚠️ Przekroczono Staminę (+X min)"
  - [ ] Tasks below = red-tinted
- [ ] Integrate StaminaCutoffLine into DailyView / CalendarView day columns

## 🎨 Phase 10: Frontend — Combat Text & Fog
- [ ] Extend `/src/components/ui/FloatingCombatText.tsx`
  - [ ] Support multiple simultaneous texts
  - [ ] Gold: XP values
  - [ ] Red: stat gains (+20 Siła)
  - [ ] Yellow: AP changes (+15 AP)
  - [ ] Sound on boost: E5 (659.25 Hz, 150ms)
- [ ] Create `/src/components/calendar/FogOfWar.tsx`
  - [ ] opacity formula: `1 - min((daysDiff-2)*0.15, 0.6)`
  - [ ] Applied to day columns where date > today+2
  - [ ] onMouseEnter: remove fog
  - [ ] onMouseLeave: restore fog

## 🎨 Phase 11: QuickAdd Updates
- [ ] Add DurationPicker to QuickAdd
- [ ] Add "🌿 Regeneratywne" toggle
- [ ] Add "👑 Main Quest" toggle (disabled if main quest already set today)
- [ ] AP preview updates as duration changes
- [ ] Main quest: warn if trying to set second one for same day

## 🚀 Phase 12: Finalization
- [ ] `ruff check app/services/daily_log_service.py app/routers/daily_system.py`
- [ ] `pnpm tsc --noEmit`
- [ ] `pnpm eslint src/components/daily/ src/components/ui/DurationPicker.tsx`
- [ ] Test: briefing modal shows on fresh day, skips if already done
- [ ] Test: DurationPicker scrolls smoothly, values correct
- [ ] Test: boost cooldown countdown works
- [ ] Test: stamina cutoff line appears correctly
- [ ] Test: decay style on overdue tasks
- [ ] Test: sound plays on task complete (requires user interaction first)
- [ ] Test: main quest gold border renders
