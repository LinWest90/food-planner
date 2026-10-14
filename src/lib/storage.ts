// Temporary on-device storage. This will move to a database (Supabase) so
// the coach share link and weekly reports can read the same data.
import type Anthropic from "@anthropic-ai/sdk";
import type { FoodLog } from "./checkins";
import type { CyclePhase } from "./cycle";
import { DEFAULT_GOAL_INPUT, type GoalInput } from "./goals";
import type { PlanningMode } from "./maia/prompt";
import type { WeekPlan } from "./plan";

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

const SESSION_KEY = "food-planner:planning-session";

export function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable; the session still works until reload.
  }
}

export interface PlanningSession {
  weekStart: string;
  phases: CyclePhase[];
  mode: PlanningMode;
  history: Anthropic.Beta.BetaMessageParam[];
  plan: WeekPlan | null;
}

export const loadPlanningSession = () => loadJson<PlanningSession>(SESSION_KEY);
export const savePlanningSession = (session: PlanningSession) => saveJson(SESSION_KEY, session);

const LOG_KEY = "food-planner:food-log";

export const loadFoodLog = () => loadJson<FoodLog>(LOG_KEY) ?? {};
export const saveFoodLog = (log: FoodLog) => saveJson(LOG_KEY, log);
