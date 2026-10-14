-- Favorite meals, by slot. `meal` has the same shape as a planned meal
-- (src/lib/plan.ts MealSchema): name, ingredients, calories and macros.

create table public.favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  meal jsonb not null check (jsonb_typeof(meal -> 'name') = 'string'),
  created_at timestamptz not null default now()
);

-- One favorite per name and slot.
create unique index favorites_user_slot_name on public.favorites (user_id, slot, lower(meal ->> 'name'));

alter table public.favorites enable row level security;

create policy "Own favorites" on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
