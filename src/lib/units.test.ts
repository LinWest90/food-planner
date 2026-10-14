import { test } from "node:test";
import assert from "node:assert/strict";
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, round1 } from "./units.ts";

test("pounds and kilograms round-trip", () => {
  assert.equal(round1(lbToKg(150)), 68);
  assert.equal(round1(kgToLb(lbToKg(150))), 150);
});

test("feet and inches to centimeters", () => {
  assert.equal(round1(feetInchesToCm(5, 6)), 167.6);
  assert.deepEqual(cmToFeetInches(feetInchesToCm(5, 6)), { feet: 5, inches: 6 });
  assert.deepEqual(cmToFeetInches(feetInchesToCm(5, 11.9)), { feet: 5, inches: 11.9 });
});
