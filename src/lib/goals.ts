// Calorie and macro goal calculator.
//
// Uses the Mifflin-St Jeor equation for resting energy (BMR), standard
// activity multipliers for total daily energy (TDEE), and the common
// ~7700 kcal per kg of body weight approximation for the deficit/surplus.
// These are population estimates, not measurements: treat the output as a
// starting point to adjust with your coach based on real weekly results.

export type Sex = "female" | "male";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very"
  | "extra";

export const ACTIVITY_LEVELS: Record<
  ActivityLevel,
  { label: string; description: string; multiplier: number }
> = {
  sedentary: { label: "Sedentary", description: "Desk job, little exercise", multiplier: 1.2 },
  light: { label: "Lightly active", description: "Exercise 1–3 days/week", multiplier: 1.375 },
  moderate: { label: "Moderately active", description: "Exercise 3–5 days/week", multiplier: 1.55 },
  very: { label: "Very active", description: "Hard exercise 6–7 days/week", multiplier: 1.725 },
  extra: { label: "Extra active", description: "Physical job + hard training", multiplier: 1.9 },
};

export interface GoalInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  targetWeightKg: number;
  weeks: number;
  /** Grams of protein per kg of current body weight. */
  proteinPerKg: number;
  /** Share of calories from fat, 0–1. */
  fatShare: number;
}

export interface GoalResult {
  bmr: number;
  tdee: number;
  dailyAdjustment: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  weeklyChangeKg: number;
  warnings: string[];
}

// Starting values for the form: 5 ft 6 in, 150 lb → 141 lb.
export const DEFAULT_GOAL_INPUT: GoalInput = {
  sex: "female",
  ageYears: 30,
  heightCm: 167.64,
  weightKg: 68.04,
  activity: "moderate",
  targetWeightKg: 63.96,
  weeks: 12,
  proteinPerKg: 1.8,
  fatShare: 0.3,
};

const KCAL_PER_KG = 7700;
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };
// Commonly cited lower bound for unsupervised intake; not a medical rule.
const MIN_CALORIES = 1200;

export function calculateBmr({ sex, ageYears, heightCm, weightKg }: GoalInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return base + (sex === "male" ? 5 : -161);
}

export function calculateGoals(input: GoalInput): GoalResult {
  const warnings: string[] = [];
  const bmr = calculateBmr(input);
  const tdee = bmr * ACTIVITY_LEVELS[input.activity].multiplier;

  const weeks = Math.max(1, input.weeks);
  const weeklyChangeKg = (input.targetWeightKg - input.weightKg) / weeks;
  const dailyAdjustment = (weeklyChangeKg * KCAL_PER_KG) / 7;
  const calories = tdee + dailyAdjustment;

  if (weeklyChangeKg < 0 && -weeklyChangeKg > input.weightKg * 0.01) {
    warnings.push(
      "This pace is faster than about 1% of body weight per week. Consider a longer time frame.",
    );
  }
  if (calories < MIN_CALORIES) {
    warnings.push(
      `The target is under ${MIN_CALORIES} kcal/day. Check this with your coach before using it.`,
    );
  }

  const proteinG = input.proteinPerKg * input.weightKg;
  const fatG = (calories * input.fatShare) / KCAL_PER_G.fat;
  const carbKcal = calories - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;
  if (carbKcal < 0) {
    warnings.push("Protein and fat settings use up all calories. Lower one of them.");
  }
  const carbsG = Math.max(0, carbKcal) / KCAL_PER_G.carbs;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyAdjustment: Math.round(dailyAdjustment),
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
    weeklyChangeKg: Math.round(weeklyChangeKg * 100) / 100,
    warnings,
  };
}
