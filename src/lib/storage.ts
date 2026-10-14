// Temporary on-device storage. This will move to a database (Supabase) so
// the coach share link and weekly reports can read the same data.
import { DEFAULT_GOAL_INPUT, type GoalInput } from "./goals";

const GOAL_KEY = "food-planner:goal-input";

export function loadGoalInput(): GoalInput | null {
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    return raw ? { ...DEFAULT_GOAL_INPUT, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function saveGoalInput(input: GoalInput): void {
  try {
    localStorage.setItem(GOAL_KEY, JSON.stringify(input));
  } catch {
    // Storage can be unavailable (private mode); the form still works.
  }
}
