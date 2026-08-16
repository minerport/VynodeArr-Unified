import test from "node:test";
import assert from "node:assert/strict";
import { fingerprintAudio, lookupAcoustId } from "../.server-build/packages/platform/src/audio-fingerprint.js";

test("Chromaprint output is normalized for AcoustID lookup", async () => {
  const value = await fingerprintAudio("/music/track.flac", {
    runner: async (binary, args) => {
      assert.equal(binary, "fpcalc");
      assert.deepEqual(args, ["-json", "/music/track.flac"]);
      return { stdout: JSON.stringify({ duration: 201.4, fingerprint: "abc" }) };
    },
  });
  assert.deepEqual(value, { duration: 201, fingerprint: "abc" });
});

test("AcoustID matching retains only confident MusicBrainz recordings", async () => {
  const matches = await lookupAcoustId("/music/track.flac", {
    endpoint: "https://api.acoustid.test/v2",
    apiKey: "user-key",
  }, {
    fingerprinter: async () => ({ duration: 200, fingerprint: "fingerprint" }),
    fetcher: async (url) => {
      assert.equal(url.searchParams.get("client"), "user-key");
      return new Response(JSON.stringify({
        status: "ok",
        results: [
          { id: "strong", score: 0.95, recordings: [{ id: "recording-1", title: "Track" }] },
          { id: "weak", score: 0.4, recordings: [{ id: "recording-2" }] },
        ],
      }));
    },
  });
  assert.deepEqual(matches.map((value) => value.recordingId), ["recording-1"]);
});
