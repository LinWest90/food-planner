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

To use Maia, copy `.env.example` to `.env.local` and add your Anthropic API
key. The key stays on the server and is never sent to the browser.

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
      plus activity multiplier, about 7700 kcal per kg). Stored on the device
      for now.
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
- [ ] Database and sign-in (Supabase) so the data can be shared
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
- **No sign-in yet**: anyone who can reach `/api/maia` could use the API
  key. Don't deploy publicly until sign-in is added.
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
