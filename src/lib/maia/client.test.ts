import { test } from "node:test";
import assert from "node:assert/strict";
import { describeMaiaError } from "./client.ts";

const quiet = () => {
  const original = console.error;
  console.error = () => {};
  return () => (console.error = original);
};

test("specific messages for common Claude API failures", () => {
  const restore = quiet();
  try {
    assert.match(describeMaiaError({ status: 402, message: "credit balance is too low" }, "t"), /out of credit/);
    assert.match(describeMaiaError({ status: 529, message: "Overloaded" }, "t"), /overloaded/);
    assert.match(describeMaiaError({ status: 400, message: "messages: bad thing" }, "t"), /messages: bad thing/);
    assert.match(describeMaiaError({ name: "APIConnectionTimeoutError" }, "t"), /timeout/);
    assert.match(describeMaiaError(new TypeError("x"), "t"), /\(TypeError\)/);
  } finally {
    restore();
  }
});
