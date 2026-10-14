-- Food planner schema. Each user only ever sees their own rows (RLS).
-- Plans and logs are stored as JSON documents in the shapes the app
-- already uses (see src/lib/plan.ts and src/lib/checkins.ts).

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  goal_input jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.week_plans (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null,
  phases text[] not null default '{}',
  mode text not null default 'prep' check (mode in ('prep', 'daily')),
  -- Maia planning chat, exactly as returned by the Claude API.
  history jsonb not null default '[]',
  plan jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create table public.day_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  check_ins jsonb not null default '{}',
  extras jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.profiles enable row level security;
alter table public.week_plans enable row level security;
alter table public.day_logs enable row level security;

create policy "Own profile" on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own week plans" on public.week_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own day logs" on public.day_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch before update on public.week_plans
  for each row execute function public.touch_updated_at();
create trigger touch before update on public.day_logs
  for each row execute function public.touch_updated_at();
