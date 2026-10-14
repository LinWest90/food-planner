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
   run `supabase/migrations/20261014120000_init.sql`. Alternatively, run
   `npx supabase link` and then `npx supabase db push`.
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
- [ ] Favorites (breakfast / lunch / dinner / snacks) and recipes
- [ ] Recipe import from a link (web pages; social posts depend on what
      each site exposes)
- [ ] Nutrition label photo → macros (Claude vision)
- [ ] Coach share link and weekly report

## Planned architecture

- **Next.js on Vercel**: the UI plus server routes that call Claude, so
  the API key never reaches the browser.
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
- **Weekly report**: a scheduled job every Sunday writes the report and
  updates the coach's share link page.

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
