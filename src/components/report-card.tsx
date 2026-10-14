import type { ReportNarrative } from "@/lib/maia/report-prompt";
import type { WeekStats } from "@/lib/report";
import { PHASE_LABELS } from "@/lib/cycle";

const SHORT_DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

export function formatDate(isoDate: string, format = SHORT_DAY) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return format.format(new Date(y, m - 1, d));
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** A week's numbers, plus Maia's write-up when there is one. Used in the app and on the coach page. */
export default function ReportCard({
  stats,
  narrative,
  title,
  children,
}: {
  stats: WeekStats;
  narrative?: ReportNarrative | null;
  title?: string;
  children?: React.ReactNode;
}) {
  const t = stats.target;
  const pct = stats.mealsAnswered ? Math.round((stats.mealsAsPlanned / stats.mealsAnswered) * 100) : null;

  return (
    <section className="rounded-xl border border-line bg-surface p-4 text-sm">
      <h2 className="font-semibold">{title ?? `Week of ${formatDate(stats.weekStart)}`}</h2>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Avg kcal" value={stats.avgCalories ?? "–"} sub={`target ${t.calories}`} />
        <Stat label="Avg protein" value={stats.avgProteinG === null ? "–" : `${stats.avgProteinG} g`} sub={`target ${t.proteinG} g`} />
        <Stat label="As planned" value={pct === null ? "–" : `${pct}%`} sub={`${stats.mealsAsPlanned} of ${stats.mealsAnswered} meals`} />
      </dl>
      <p className="mt-2 text-xs text-muted">
        {stats.mealsAnswered} of {stats.mealsPlanned} meals checked in · {stats.daysFullyLogged} of {stats.days.length}{" "}
        days fully logged. Averages use fully logged days only.
      </p>

      {narrative && (
        <div className="mt-4 space-y-3 leading-relaxed">
          <p>{narrative.summary}</p>
          <List title="Wins" items={narrative.wins} />
          <List title="Worth watching" items={narrative.watchOuts} />
          <List title="Next week" items={narrative.nextWeek} />
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium">Day by day</summary>
        <ul className="mt-2 divide-y divide-line">
          {stats.days.map((d) => (
            <li key={d.date} className="py-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {formatDate(d.date)}
                  {d.phase && <span className="ml-1 text-xs font-normal text-muted">· {PHASE_LABELS[d.phase]}</span>}
                </span>
                <span className="text-xs text-muted tabular-nums">
                  {d.answered}/{d.meals} checked in
                </span>
              </div>
              <p className="text-xs tabular-nums">
                {d.answered === d.meals && d.meals > 0
                  ? `${d.eaten.calories} kcal (${signed(d.eaten.calories - t.calories)}) · P ${d.eaten.proteinG} g`
                  : `Planned ${d.planned.calories} kcal · P ${d.planned.proteinG} g`}
              </p>
              {d.changes.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs text-muted">
                  {d.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </details>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-lg bg-accent-soft p-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-[11px] text-muted">{sub}</dd>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
