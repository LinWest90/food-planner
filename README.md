# Food Planner

A phone-first web app for planning the week's food with **Maia**, an AI
assistant, keeping calories and macros on target, and sharing progress
with a coach.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests
npm run lint
```

Copy `.env.example` to `.env.local` and fill it in (see **Setting up
Supabase** below). The Anthropic key stays on the server and is never sent
to the browser. Variables already set in your shell or hosting environment
take priority over `.env.local`.

## Setting up Supabase

1. **Create the tables.** In your Supabase project, open the SQL editor and
   run each file in `supabase/migrations/` once, oldest first
   (`20261014120000_init.sql`, `20261015120000_coach_and_reports.sql`,
   `20261016120000_coach_comments.sql`, then `20261017120000_favorites.sql`).
   Alternatively, run `npx supabase link` and then `npx supabase db push`.
2. **Create your account.** In Authentication → Users, add a user with your
   email and a password. The app has no sign-up screen.
3. **Turn off sign-ups** in the Authentication settings ("Allow new users to
   sign up"). Dashboard labels change over time, so look for the equivalent
   setting if the name differs.
4. **Keys.** Put the project URL and the publishable key (or the older
   "anon" key; either works) in `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   These are meant to be public: row level security means each signed-in
   user can only read and write their own rows.
5. **Lock Maia to you.** Set `ALLOWED_EMAILS` to your email (comma-separate
   to add more).

For local development without touching the real project, `npx supabase
start` runs a local copy in Docker (it prints a local URL and keys).

## Deploying to Vercel

1. Sign in at vercel.com with GitHub, then **Add New → Project** and import
   this repository. Vercel detects Next.js automatically.
2. Before the first deploy, add these **Environment Variables**:
   `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `..._PUBLISHABLE_KEY`) and
   `ALLOWED_EMAILS`. The `NEXT_PUBLIC_` values are built into the app, so
   redeploy after changing them.
   For scheduled weekly reports, also add `SUPABASE_SECRET_KEY` (the
   project's secret / service-role key; server only, never `NEXT_PUBLIC_`)
   and `CRON_SECRET` (any long random string).
3. Deploy. Every push to the production branch (the repository's default
   branch) redeploys automatically.
4. On your iPhone, open the site in Safari → Share → **Add to Home Screen**.
   It then opens full screen with its own icon.

`vercel.json` schedules `/api/cron/weekly-reports` daily at 10:00 UTC.
It writes any missing reports for weeks that ended in the last two weeks
and skips weeks that already have one, so a missed or repeated run is
harmless. Vercel sends `Authorization: Bearer $CRON_SECRET`; other callers
get 401.

Maia's planning route can run up to 300 seconds (`maxDuration`), which
is within Vercel's Hobby plan limit when Fluid compute is on (the default).

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4.

## Decisions so far

| Topic | Decision |
| --- | --- |
| Platform | Phone web app you can add to your home screen (PWA) |
| Users | Just me + my coach |
| Coach access | Private read-only share link |
| AI | Claude (Anthropic API), called only from the server |
| Cycle data | Pick the week's phases with buttons when planning (no automatic sync) |
| Language / units | English; lb and ft/in, with kg/cm shown alongside (stored in metric) |

## Status

- [x] **Step 1: goal setup** (`/goals`). Weight, height, age, activity, goal
      weight and time frame give daily calories and macros (Mifflin-St Jeor
      plus activity multiplier, about 7700 kcal per kg). Saved
      in the database.
- [x] **Planning chat with Maia** (`/plan`). Pick the week, tap the cycle
      phases in the order they'll happen (e.g. Luteal → Menstrual), choose
      meal prep or cook each meal, then chat. Maia saves the plan with a
      tool call. The app adds up each day's totals, and Maia corrects
      portions if a day is off target.
- [x] Plan, shopping list and prep list tabs
- [x] **Meal check-ins** (`/today`). After each meal's time (breakfast 9:00,
      lunch 13:00, snack 16:00, dinner 19:30) the home screen asks "Did lunch
      happen as planned?". Answer ✅ or ❌. For ❌, describe what you ate
      instead and Maia estimates it and suggests changes to later meals.
      Nothing changes until you tap "Update my plan". You can also log
      extra food, and see the day so far and the week's projected total.
      In-app only for now; phone notifications need the hosted version.
- [x] **Database and sign-in** (Supabase). Email and password sign-in. Goal,
      week plans (including the Maia chat) and check-ins are stored per
      user, protected by row level security, so they sync across devices.
      Maia's API routes check the sign-in token (and `ALLOWED_EMAILS`).
- [x] **Favorites** (`/favorites`), grouped as breakfast, lunch, dinner and
      snacks. Save a planned meal with ☆/★ on the Plan tab, or describe one
      (optionally with a photo) and Maia works out ingredients and macros
      for you to review. Maia gets the list each time you plan and builds
      the week around them, scaling portions to your targets.
- [ ] Recipe import from a link (web pages; social posts depend on what
      each site exposes)
- [x] **Photos for Maia** in the planning chat (📷, up to 4 per message):
      nutrition labels, packaging, recipes or meals. Photos are shrunk on
      the phone, stored with Anthropic's Files API, and the chat keeps
      only their file ids. Maia reads label values, says what she read,
      and asks again if a label is unreadable. Check-ins take photos too
      (of the meal, menu or label), with or without a note.
- [x] **Weekly reports** (`/report`). The app computes the week's numbers
      (meals checked in, % as planned, average kcal and protein on fully
      logged days, what changed), and Maia writes a short summary, wins,
      things to watch and next-week focus. Written by a daily scheduled
      job (or when the app is opened) after a week ends, or on demand.
- [x] **Coach link** (`/coach/<token>`). A private read-only page (no
      account needed) with targets, recent plans, check-ins and reports,
      but not the Maia chat. It can be created, replaced or turned off from
      `/report`. The page reads data only through the `coach_view` database
      function, which returns nothing for an unknown token.
- [x] **Coach comments.** The coach can comment on any week from the link
      (with an optional name, remembered on her device); you see new
      comments on the home screen and can reply or delete from `/report`.
      Coach comments go in only through `coach_add_comment` (valid token,
      at most 30 an hour).

## Planned architecture

- **Next.js on Vercel**: the UI plus server routes that call Claude, so
  the API key never reaches the browser. Installable on the home screen
  (web manifest + icons in `src/app/`).
- **Supabase**: Postgres database, sign-in, and photo storage for labels.
- **Claude tool use**: Maia runs on Claude Opus 5.5 (`src/app/api/maia/route.ts`)
  and saves plans through a `save_week_plan` tool. The app adds up the
  totals; the model doesn't do the arithmetic. Per-meal calories and
  macros are still Maia's estimates until a food database is connected.
  Check-ins (`src/app/api/checkin/route.ts`) use structured output: Maia
  returns what you ate plus changes to meals, and the app only accepts
  changes to meals that haven't happened yet.
- **Refusal fallback**: requests opt in to Anthropic's server-side
  fallback (`fallbacks: "default"`), so if a safety check declines a
  request, the API retries it on another model instead of failing.
- **Data model** (`supabase/migrations/`): `profiles` (goal), `week_plans`
  (one row per week: phases, mode, Maia chat, plan) and `day_logs` (one
  row per day: check-ins and extras). Plans and logs are stored as JSON
  in the same shapes the app uses.
- **Nutrition data**: food values come from a public food database. The
  candidates still need checking for coverage and licence: the Swedish
  Food Agency database, USDA FoodData Central, and Open Food Facts for
  packaged foods / barcodes. Label photos override database values.
- **Reminders**: meal check-ins as web push notifications. iOS supports
  these only for web apps added to the home screen (iOS 16.4+), so this
  needs testing on a real phone.
- **Weekly report timing**: a daily Vercel Cron job writes missing
  reports using the Supabase secret key (server only). Opening the app
  after a week ends also writes one if it's still missing.

### Cycle phases

There's no reliable way to get Natural Cycles data into a web app
(Natural Cycles can export period data to Apple Health, but Shortcuts
can't read it back out). So you choose the coming week's phases with buttons
when planning, in the order they'll happen. Maia asks which day the phase
changes if it matters.

## Accounts needed

- Anthropic API key (console.anthropic.com), paid per use
- Supabase project (free tier to start)
- Vercel account for hosting (free tier to start)

Keys go in `.env.local`, which isn't committed.
