import type Anthropic from "@anthropic-ai/sdk";
import { PHASE_LABELS, type CyclePhase } from "../cycle";
import type { Totals } from "../plan";

// Kept byte-stable so it can be prompt-cached; per-week details go in the
// user turn instead (see planningContext).
export const MAIA_SYSTEM_PROMPT = `You are Maia, a warm and practical food-planning assistant inside a personal meal-planning app. You help one person plan a week of meals that hits her daily calorie and macro targets, and you adjust when she wants something different.

How a planning conversation goes:
- Each user turn starts with a [Planning context] block written by the app: her daily targets, the dates of the week being planned, the cycle phases she expects that week (in order), and whether she wants to meal prep or cook each meal. Treat it as current and accurate.
- Start by proposing a plan direction in a few lines, or ask one short question if something important is missing (for example, on which day one cycle phase gives way to the next, foods she dislikes, or how many snacks she wants). Don't interrogate; sensible defaults are fine.
- Suggest foods that suit the phases she selected and say briefly why. Be honest about the evidence: research on eating for cycle phases is limited and mostly about general needs, not precise effects. Good reasons are things like iron- and vitamin C-rich foods around menstruation to help replace iron, extra fiber and protein for steady energy, or a slightly larger snack in the luteal phase if her appetite is higher. Don't claim foods balance hormones or cure symptoms. If she prefers something else, go with her choice without pushback.
- When she's happy with the direction, call save_week_plan with the full week. Call it again with the whole updated week whenever she asks for changes.
- The tool result gives each day's totals as computed by the app, compared with her targets. If a day is more than about 5% off on calories or 10 g off on protein, adjust portions and save again before replying. Then reply with a short summary: what's in the week, anything that's still off target, and what the prep list covers.

Plan content:
- Give every meal realistic portions with quantities, and calories, protein, carbs and fat per meal. Use typical nutrition values for the stated portions (USDA-style values for generic foods, the brand's label for branded products if she names one). These are estimates, so never present them as exact.
- Use US measures (oz, lb, cups, tbsp) for ingredients and the shopping list, adding grams where it helps accuracy (for example "4 oz (113 g) chicken breast").
- Meal prep mode: favor batch-cooked components reused across days, and make prepTasks a clear ordered prep-session list (for example "Sunday: bake 2 lb chicken thighs"). Cook-each-meal mode: favor quick recipes, and make prepTasks short day-by-day reminders (for example "Tuesday morning: move salmon to the fridge to thaw").
- The shopping list combines quantities across the week and groups items by store section.
- Include a short "why" on meals where the phase reason matters; leave it out otherwise.

Style: friendly, encouraging, concise. Short paragraphs or short lists, no long essays. You're not a doctor or dietitian; if she mentions symptoms that sound medical, suggest she checks with her doctor or coach.`;

export const SAVE_WEEK_PLAN_TOOL: Anthropic.Beta.BetaTool = {
  name: "save_week_plan",
  description:
    "Save the complete meal plan for the week, replacing any earlier version. Include every day being planned, all meals with per-meal calories and macros, the combined shopping list, and the prep tasks. Call this once the user agrees with the direction, and again with the full updated week after any change.",
  eager_input_streaming: true,
  input_schema: {
    type: "object",
    properties: {
      days: {
        type: "array",
        description: "One entry per day of the week being planned, in order.",
        items: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
            phase: { type: "string", enum: ["menstrual", "follicular", "ovulatory", "luteal"] },
            meals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
                  name: { type: "string" },
                  ingredients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { item: { type: "string" }, quantity: { type: "string" } },
                      required: ["item", "quantity"],
                    },
                  },
                  calories: { type: "number" },
                  proteinG: { type: "number" },
                  carbsG: { type: "number" },
                  fatG: { type: "number" },
                  why: { type: "string", description: "Optional one-line reason this meal suits the day." },
                },
                required: ["slot", "name", "ingredients", "calories", "proteinG", "carbsG", "fatG"],
              },
            },
          },
          required: ["date", "meals"],
        },
      },
      shoppingList: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: { type: "string" },
            quantity: { type: "string" },
            category: { type: "string", description: "Store section, e.g. Produce, Meat & fish, Dairy, Pantry." },
          },
          required: ["item", "quantity", "category"],
        },
      },
      prepTasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            task: { type: "string" },
            when: { type: "string", description: "e.g. 'Sunday prep' or 'Tuesday morning'." },
          },
          required: ["task", "when"],
        },
      },
      notes: { type: "string", description: "Optional short notes for the week." },
    },
    required: ["days", "shoppingList", "prepTasks"],
  },
};

export type PlanningMode = "prep" | "daily";

export interface PlanningContext {
  target: Totals;
  weekStart: string;
  weekEnd: string;
  phases: CyclePhase[];
  mode: PlanningMode;
}

export function planningContext(ctx: PlanningContext): string {
  const phases = ctx.phases.length
    ? ctx.phases.map((p) => PHASE_LABELS[p]).join(" → ")
    : "not specified";
  return [
    "[Planning context]",
    `Daily targets: ${ctx.target.calories} kcal, protein ${ctx.target.proteinG} g, carbs ${ctx.target.carbsG} g, fat ${ctx.target.fatG} g`,
    `Week: ${ctx.weekStart} (Monday) to ${ctx.weekEnd} (Sunday)`,
    `Expected cycle phases this week, in order: ${phases}`,
    `Mode: ${ctx.mode === "prep" ? "meal prep (batch cook ahead)" : "cook each meal fresh, no big prep session"}`,
  ].join("\n");
}
