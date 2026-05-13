-- migrations/017_steps_module.sql
-- Step tracking + weekly step goal on users.

create table if not exists step_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  date        date not null,
  steps       integer not null check (steps >= 0 and steps <= 100000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_step_logs_user_date
  on step_logs (user_id, date desc);

alter table step_logs enable row level security;

drop policy if exists "step_logs_owner_all" on step_logs;
create policy "step_logs_owner_all"
  on step_logs for all
  using (user_id = (select id from users limit 1))
  with check (user_id = (select id from users limit 1));

alter table users
  add column if not exists weekly_step_goal integer not null default 70000;

alter table users
  add constraint users_weekly_step_goal_range
  check (weekly_step_goal >= 1000 and weekly_step_goal <= 200000);
