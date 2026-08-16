import test from "node:test";
import assert from "node:assert/strict";
import { ProviderResilience } from "../.server-build/packages/platform/src/provider-resilience.js";

test("provider resilience opens after repeated failures and reports health", async () => {
  const resilience = new ProviderResilience({ failureThreshold: 2, cooldownMs: 60_000 });
  let calls = 0;
  const fail = () => resilience.run("provider", async () => {
    calls += 1;
    throw new Error("rate limited");
  });
  await assert.rejects(fail, /rate limited/);
  await assert.rejects(fail, /rate limited/);
  await assert.rejects(fail, /temporarily paused/);
  assert.equal(calls, 2);
  assert.equal(resilience.snapshot()[0].state, "open");
  assert.equal(resilience.snapshot()[0].failures, 2);
});
