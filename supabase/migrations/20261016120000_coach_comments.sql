-- Comments on a week: from the coach (through the share link) and replies
-- from the user.

create table public.coach_comments (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null,
  author text not null check (author in ('coach', 'me')),
  author_name text check (char_length(author_name) <= 60),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  -- When the user saw a coach comment; null = unread.
  read_at timestamptz
);

create index coach_comments_user_week on public.coach_comments (user_id, week_start);

alter table public.coach_comments enable row level security;

create policy "Read own comments" on public.coach_comments for select to authenticated
  using (user_id = (select auth.uid()));
-- The user can only add their own replies; coach comments come in through
-- coach_add_comment() below.
create policy "Add own replies" on public.coach_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and author = 'me');
create policy "Mark comments read" on public.coach_comments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own comments" on public.coach_comments for delete to authenticated
  using (user_id = (select auth.uid()));

-- Adds a coach comment through the share link. Returns null for an unknown
-- link. Capped at 30 comments an hour per link to limit misuse.
create function public.coach_add_comment(p_token text, p_week_start date, p_body text, p_name text)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid;
  added public.coach_comments;
begin
  select user_id into uid from public.coach_shares where token = p_token;
  if uid is null then
    return null;
  end if;
  if (select count(*) from public.coach_comments
      where user_id = uid and author = 'coach' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many comments in the last hour. Please try again later.';
  end if;
  insert into public.coach_comments (user_id, week_start, author, author_name, body)
  values (uid, p_week_start, 'coach', nullif(trim(p_name), ''), trim(p_body))
  returning * into added;
  return jsonb_build_object(
    'id', added.id, 'week_start', added.week_start, 'author', added.author,
    'author_name', added.author_name, 'body', added.body, 'created_at', added.created_at
  );
end;
$$;

revoke all on function public.coach_add_comment(text, date, text, text) from public;
grant execute on function public.coach_add_comment(text, date, text, text) to anon, authenticated;

-- The coach view now includes the comment threads.
create or replace function public.coach_view(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid;
begin
  select user_id into uid from public.coach_shares where token = p_token;
  if uid is null then
    return null;
  end if;
  return jsonb_build_object(
    'goal', (select goal_input from public.profiles where user_id = uid),
    'weeks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week_start', w.week_start, 'phases', w.phases, 'mode', w.mode, 'plan', w.plan
      ) order by w.week_start desc)
      from (select * from public.week_plans where user_id = uid order by week_start desc limit 6) w
    ), '[]'::jsonb),
    'logs', coalesce((
      select jsonb_object_agg(d.date, jsonb_build_object('checkIns', d.check_ins, 'extras', d.extras))
      from public.day_logs d
      where d.user_id = uid and d.date >= current_date - 56
    ), '{}'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week_start', r.week_start, 'stats', r.stats, 'narrative', r.narrative, 'updated_at', r.updated_at
      ) order by r.week_start desc)
      from (select * from public.weekly_reports where user_id = uid order by week_start desc limit 12) r
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'week_start', c.week_start, 'author', c.author,
        'author_name', c.author_name, 'body', c.body, 'created_at', c.created_at
      ) order by c.created_at)
      from public.coach_comments c
      where c.user_id = uid and c.week_start >= current_date - 112
    ), '[]'::jsonb)
  );
end;
$$;
