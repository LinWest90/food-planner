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

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4.

## Decisions so far

| Topic | Decision |
| --- | --- |
| Platform | Phone web app you can add to your home screen (PWA) |
| Users | Just me + my coach |
| Coach access | Private read-only share link |
| AI | Claude (Anthropic API), called only from the server |
| Cycle data | Sync from an iPhone cycle-tracking app (which app is still open) |

## Status

- [x] **Step 1: goal setup** (`/goals`). Weight, height, age, activity, goal
      weight and time frame give daily calories and macros (Mifflin-St Jeor
      plus activity multiplier, about 7700 kcal per kg). Stored on the device
      for now.
- [ ] Database and sign-in (Supabase) so the data can be shared
- [ ] Weekly planning chat with Maia, with cycle-phase suggestions and
      reasons you can accept or override
- [ ] Weekly plan view: prep mode vs cook-each-meal mode
- [ ] Shopping list and meal prep to-do list made from the plan
- [ ] Favorites (breakfast / lunch / dinner / snacks) and recipes
- [ ] Recipe import from a link (web pages; social posts depend on what
      each site exposes)
- [ ] Nutrition label photo → macros (Claude vision)
- [ ] Meal check-ins: "Did this meal happen as planned?" ✅ / ❌, then
      Maia rebalances the rest of the day or week
- [ ] Cycle sync (see below)
- [ ] Coach share link and weekly report

## Planned architecture

- **Next.js on Vercel**: the UI plus server routes that call Claude, so
  the API key never reaches the browser.
- **Supabase**: Postgres database, sign-in, and photo storage for labels.
- **Claude tool use**: Maia gets tools such as `lookup_food`,
  `set_meal`, `log_deviation` and `get_day_totals`. The app computes
  totals from stored food data. The model doesn't do the arithmetic.
- **Nutrition data**: food values come from a public food database. The
  candidates still need checking for coverage and licence: the Swedish
  Food Agency database, USDA FoodData Central, and Open Food Facts for
  packaged foods / barcodes. Label photos override database values.
- **Reminders**: meal check-ins as web push notifications. iOS supports
  these only for web apps added to the home screen (iOS 16.4+), so this
  needs testing on a real phone.
- **Weekly report**: a scheduled job every Sunday writes the report and
  updates the coach's share link page.

### Cycle sync

A web app can't read Apple Health directly. The plan is an **Apple
Shortcuts** automation that reads cycle data and posts it to a private
app endpoint. Two things are still unconfirmed:

1. whether the cycle app writes period data to Apple Health, and
2. whether Shortcuts can read menstrual data from Health.

Manual "period started" logging will be built as a fallback either way.

## Accounts needed

- Anthropic API key (console.anthropic.com), paid per use
- Supabase project (free tier to start)
- Vercel account for hosting (free tier to start)

Keys go in `.env.local`, which isn't committed.
