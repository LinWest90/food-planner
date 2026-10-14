import { PHASE_LABELS } from "@/lib/cycle";
import { sumMeals, type Totals, type WeekPlan } from "@/lib/plan";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });

function formatDay(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return WEEKDAY.format(new Date(y, m - 1, d));
}

function Diff({ value, target, unit }: { value: number; target: number; unit: string }) {
  const diff = value - target;
  return (
    <span className="tabular-nums">
      {value}
      {unit}{" "}
      <span className="text-muted">
        ({diff > 0 ? "+" : ""}
        {diff})
      </span>
    </span>
  );
}

export default function PlanView({
  plan,
  target,
  view,
  onTogglePrep,
}: {
  plan: WeekPlan | null;
  target: Totals;
  view: "Plan" | "Shopping" | "Prep";
  onTogglePrep: (index: number) => void;
}) {
  if (!plan) {
    return <p className="text-sm text-muted">No plan yet. Chat with Maia to make one.</p>;
  }

  if (view === "Shopping") {
    const byCategory = new Map<string, WeekPlan["shoppingList"]>();
    for (const item of plan.shoppingList) {
      byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
    }
    return (
      <div className="space-y-4">
        {[...byCategory].map(([category, items]) => (
          <section key={category}>
            <h2 className="text-sm font-semibold">{category}</h2>
            <ul className="mt-1 divide-y divide-line rounded-lg border border-line bg-surface">
              {items.map((i) => (
                <li key={i.item} className="flex justify-between gap-3 px-3 py-2 text-sm">
                  <span>{i.item}</span>
                  <span className="text-right text-muted">{i.quantity}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  if (view === "Prep") {
    // One card per session ("Wednesday evening prep"), steps numbered in order.
    const sessions: { when: string; tasks: { index: number; task: string; done: boolean }[] }[] = [];
    plan.prepTasks.forEach((t, index) => {
      const step = { index, task: t.task, done: !!t.done };
      const last = sessions.at(-1);
      if (last && last.when === t.when) last.tasks.push(step);
      else sessions.push({ when: t.when, tasks: [step] });
    });
    return (
      <div className="space-y-4">
        {sessions.map((session, i) => {
          const doneCount = session.tasks.filter((t) => t.done).length;
          return (
            <section key={i} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{session.when}</h2>
                <span className="text-xs text-muted tabular-nums">
                  {doneCount === session.tasks.length ? "All done ✓" : `${doneCount} of ${session.tasks.length} done`}
                </span>
              </div>
              <ol className="mt-3 space-y-1">
                {session.tasks.map((t, j) => (
                  <li key={t.index}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={t.done}
                      onClick={() => onTogglePrep(t.index)}
                      className="flex w-full gap-3 rounded-lg py-1.5 text-left text-sm leading-relaxed"
                    >
                      <span
                        aria-hidden
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ${
                          t.done ? "border-accent bg-accent text-on-accent" : "border-line bg-accent-soft"
                        }`}
                      >
                        {t.done ? "✓" : j + 1}
                      </span>
                      <span className={`pt-0.5 ${t.done ? "text-muted line-through" : ""}`}>{t.task}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {plan.notes && <p className="text-sm text-muted">{plan.notes}</p>}
      <p className="text-xs text-muted">
        Calories and macros are Maia&apos;s estimates. Day totals are added up by the app; brackets show the
        difference from your target.
      </p>
      {plan.days.map((day) => {
        const totals = sumMeals(day.meals);
        return (
          <section key={day.date} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{formatDay(day.date)}</h2>
              {day.phase && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">{PHASE_LABELS[day.phase]}</span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
              <Diff value={totals.calories} target={target.calories} unit=" kcal" />
              <span>
                P <Diff value={totals.proteinG} target={target.proteinG} unit=" g" />
              </span>
              <span>
                C <Diff value={totals.carbsG} target={target.carbsG} unit=" g" />
              </span>
              <span>
                F <Diff value={totals.fatG} target={target.fatG} unit=" g" />
              </span>
            </p>
            <ul className="mt-3 space-y-3">
              {day.meals.map((meal, i) => (
                <li key={i} className="text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted">{meal.slot}</p>
                  <p className="font-medium">{meal.name}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {Math.round(meal.calories)} kcal · P {Math.round(meal.proteinG)} · C {Math.round(meal.carbsG)} · F{" "}
                    {Math.round(meal.fatG)}
                  </p>
                  {meal.ingredients.length > 0 && (
                    <p className="mt-0.5 text-xs">
                      {meal.ingredients.map((g) => `${g.quantity} ${g.item}`).join(", ")}
                    </p>
                  )}
                  {meal.why && <p className="mt-0.5 text-xs italic text-muted">{meal.why}</p>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
