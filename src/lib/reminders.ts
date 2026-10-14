// Which meals to send a check-in reminder for, in the user's own time zone.
import { CHECKIN_TIMES, checkInFor, type DayLog } from "./checkins.ts";
import type { Day, Meal } from "./plan.ts";

/** Only remind within this long after a meal's check-in time, so enabling reminders late doesn't send a backlog. */
export const REMINDER_WINDOW_MINUTES = 180;

/** The local date (YYYY-MM-DD) and minutes since midnight in a time zone. */
export function localNow(timeZone: string, now: Date): { date: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return localNow("UTC", now); // unknown time zone name
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Meals that are due a reminder now: past their check-in time (within the window), unanswered, not reminded yet. */
export function dueReminders(day: Day, log: DayLog, minutes: number, alreadySent: Set<number>): { index: number; meal: Meal }[] {
  return day.meals.flatMap((meal, index) => {
    const [h, m] = CHECKIN_TIMES[meal.slot];
    const since = minutes - (h * 60 + m);
    const due = since >= 0 && since < REMINDER_WINDOW_MINUTES;
    return due && !alreadySent.has(index) && !checkInFor(log, index, meal) ? [{ index, meal }] : [];
  });
}

/** The notification text for one or more due meals. */
export function reminderMessage(due: { meal: Meal }[]): { title: string; body: string } {
  if (due.length === 1) {
    return { title: `Did ${due[0].meal.slot} happen as planned?`, body: `${due[0].meal.name}. Tap to check in.` };
  }
  return {
    title: `${due.length} meals to check in`,
    body: due.map((d) => `${d.meal.slot}: ${d.meal.name}`).join(" · "),
  };
}
