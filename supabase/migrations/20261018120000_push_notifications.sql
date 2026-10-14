-- Phone notifications (Web Push) for meal check-ins.

-- One row per device that turned notifications on.
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- The device's time zone, so "1 pm" means the user's 1 pm.
  time_zone text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- Reminders already sent, so each meal is reminded at most once.
create table public.reminders_sent (
  user_id uuid not null references auth.users on delete cascade,
  date date not null,
  meal_index int not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, date, meal_index)
);

alter table public.push_subscriptions enable row level security;
alter table public.reminders_sent enable row level security;

create policy "Own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Written only by the server's scheduled job; users can read their own.
create policy "Read own reminders" on public.reminders_sent for select to authenticated
  using (user_id = (select auth.uid()));
