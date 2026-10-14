// Pulls a recipe out of a web page's HTML. Most recipe sites embed a
// schema.org Recipe as JSON-LD (for search engines), which is far more
// reliable than the visible page. Otherwise falls back to the page's title,
// description (social posts often put the caption there) and text.

export interface ExtractedRecipe {
  /** "recipe" when structured recipe data was found, else "page". */
  source: "recipe" | "page";
  title: string;
  servings?: string;
  ingredients: string[];
  steps: string[];
  nutrition?: string;
  /** Description and page text for Maia when there's no structured recipe. */
  text?: string;
}

const MAX_TEXT = 12000;

const NAMED: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  amp: "&",
  deg: "°",
  frac12: "½",
  frac13: "⅓",
  frac23: "⅔",
  frac14: "¼",
  frac34: "¾",
  frac18: "⅛",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z0-9#]+);/gi, (match, e: string) => NAMED[e.toLowerCase()] ?? match);
}

const clean = (s: unknown) =>
  typeof s === "string" ? decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim() : "";

const isRecipe = (node: Record<string, unknown>) => {
  const t = node["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
};

/** Depth-first search for a schema.org Recipe object in parsed JSON-LD. */
function findRecipe(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (isRecipe(obj)) return obj;
    for (const key of ["@graph", "mainEntity", "itemListElement"]) {
      const found = obj[key] !== undefined ? findRecipe(obj[key]) : null;
      if (found) return found;
    }
  }
  return null;
}

/** Instructions can be strings, HowToStep objects or HowToSection groups. */
function flattenSteps(node: unknown): string[] {
  if (typeof node === "string") return node.split(/\n+/).map(clean).filter(Boolean);
  if (Array.isArray(node)) return node.flatMap(flattenSteps);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj.itemListElement) return flattenSteps(obj.itemListElement);
    const text = clean(obj.text ?? obj.name);
    return text ? [text] : [];
  }
  return [];
}

function describeNutrition(n: unknown): string | undefined {
  if (!n || typeof n !== "object") return undefined;
  const obj = n as Record<string, unknown>;
  const fields: [string, string][] = [
    ["calories", "calories"],
    ["proteinContent", "protein"],
    ["carbohydrateContent", "carbs"],
    ["fatContent", "fat"],
    ["servingSize", "serving size"],
  ];
  const parts = fields.flatMap(([key, label]) => (obj[key] ? [`${label} ${clean(String(obj[key]))}`] : []));
  return parts.length ? `${parts.join(", ")} (per serving, from the recipe page)` : undefined;
}

function meta(html: string, name: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
    "i",
  );
  const m = html.match(re);
  return clean(m?.[1] ?? m?.[2] ?? "");
}

export function extractRecipe(html: string): ExtractedRecipe {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, json] of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json.trim());
    } catch {
      continue;
    }
    const recipe = findRecipe(parsed);
    if (!recipe) continue;
    const yieldValue = recipe.recipeYield;
    const servings = Array.isArray(yieldValue) ? yieldValue.map(clean).join(" / ") : clean(String(yieldValue ?? ""));
    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : []).map(clean).filter(Boolean);
    return {
      source: "recipe",
      title: clean(recipe.name) || meta(html, "og:title"),
      servings: servings || undefined,
      ingredients,
      steps: flattenSteps(recipe.recipeInstructions),
      nutrition: describeNutrition(recipe.nutrition),
    };
  }

  const title = meta(html, "og:title") || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const description = meta(html, "og:description") || meta(html, "description");
  const body = clean(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "",
  );
  const text = [description, body].filter(Boolean).join("\n\n").slice(0, MAX_TEXT);
  return { source: "page", title, ingredients: [], steps: [], text: text || undefined };
}

/** Text for Maia to turn into one serving. */
export function describeRecipe(r: ExtractedRecipe, url: string): string {
  if (r.source === "page") {
    return [`Web page: ${url}`, `Title: ${r.title || "(none)"}`, "", "Page text (may include unrelated content):", r.text ?? ""].join("\n");
  }
  return [
    `Recipe from ${url}`,
    `Name: ${r.title}`,
    r.servings ? `Makes: ${r.servings}` : "Servings: not stated",
    r.nutrition ? `Nutrition: ${r.nutrition}` : "",
    "",
    "Ingredients (whole recipe):",
    ...r.ingredients.map((i) => `- ${i}`),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Enough to work with? Pages without a recipe need some real text. */
export function hasUsableRecipe(r: ExtractedRecipe): boolean {
  return r.source === "recipe" ? r.ingredients.length > 0 : (r.text?.length ?? 0) > 80;
}
