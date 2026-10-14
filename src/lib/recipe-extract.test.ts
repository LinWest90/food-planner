import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, describeRecipe, extractRecipe, hasUsableRecipe } from "./recipe-extract.ts";

const recipeJson = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebPage", name: "Page" },
    {
      "@type": ["Recipe", "NewsArticle"],
      name: "Chicken &amp; Rice Bowls",
      recipeYield: ["4", "4 servings"],
      recipeIngredient: ["1 &frac12; lb chicken breast", "2 cups <b>jasmine</b> rice", ""],
      recipeInstructions: [
        { "@type": "HowToSection", name: "Prep", itemListElement: [{ "@type": "HowToStep", text: "Dice the chicken." }] },
        { "@type": "HowToStep", text: "Cook the rice." },
        "Serve.",
      ],
      nutrition: { "@type": "NutritionInformation", calories: "520 kcal", proteinContent: "42 g" },
    },
  ],
};

test("finds a Recipe inside @graph with mixed instruction shapes", () => {
  const html = `<html><head><script type="application/ld+json">{bad json</script>
    <script type="application/ld+json">${JSON.stringify(recipeJson)}</script></head><body>Ad text</body></html>`;
  const r = extractRecipe(html);
  assert.equal(r.source, "recipe");
  assert.equal(r.title, "Chicken & Rice Bowls");
  assert.equal(r.servings, "4 / 4 servings");
  assert.deepEqual(r.ingredients, ["1 ½ lb chicken breast", "2 cups jasmine rice"]);
  assert.deepEqual(r.steps, ["Dice the chicken.", "Cook the rice.", "Serve."]);
  assert.match(r.nutrition!, /calories 520 kcal, protein 42 g/);
  assert.ok(hasUsableRecipe(r));
  assert.match(describeRecipe(r, "https://example.com/r"), /Makes: 4 \/ 4 servings[\s\S]*- 2 cups jasmine rice/);
});

test("falls back to the page title, description and text", () => {
  const html = `<html><head><title>Ignored</title>
    <meta property="og:title" content="Protein oats by @someone">
    <meta property="og:description" content="Mix 1/2 cup oats, 1 scoop whey &amp; 1 cup milk. Let sit overnight. Top with berries for a creamy breakfast.">
    </head><body><script>var x = 1;</script><nav>Menu</nav><p>Comments are closed.</p></body></html>`;
  const r = extractRecipe(html);
  assert.equal(r.source, "page");
  assert.equal(r.title, "Protein oats by @someone");
  assert.match(r.text!, /1 scoop whey & 1 cup milk[\s\S]*Comments are closed\./);
  assert.doesNotMatch(r.text!, /var x|Menu/);
  assert.ok(hasUsableRecipe(r));
});

test("a login wall with no recipe text isn't usable", () => {
  const r = extractRecipe(`<html><head><title>Instagram</title></head><body>Log in</body></html>`);
  assert.equal(hasUsableRecipe(r), false);
});

test("decodes numeric and named entities", () => {
  assert.equal(decodeEntities("&#8217;s &#x2013; &amp; &quot;x&quot; &frac34; cup &unknown;"), "’s – & \"x\" ¾ cup &unknown;");
});
