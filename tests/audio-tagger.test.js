import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAudioTags } from "../.server-build/packages/platform/src/audio-tagger.js";

test("audio tag writing atomically replaces a completed rewrite", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-tags-")),
    path = join(directory, "track.flac");
  await writeFile(path, "original");
  let args;
  try {
    await writeAudioTags(path, { title: "Track", musicBrainzRecordingId: "recording" }, {
      runner: async (_binary, input) => {
        args = input;
        await writeFile(input.at(-1), "tagged");
        return { stdout: "", stderr: "" };
      },
    });
    assert.equal(await readFile(path, "utf8"), "tagged");
    assert.ok(args.includes("title=Track"));
    assert.ok(args.includes("MUSICBRAINZ_RECORDINGID=recording"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("audio tag writing preserves the original when rewriting fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-tags-failure-")),
    path = join(directory, "track.flac");
  await writeFile(path, "original");
  try {
    await assert.rejects(
      () => writeAudioTags(path, { title: "Track" }, { runner: async () => { throw new Error("encoder failed"); } }),
      /Audio tag writing failed/,
    );
    assert.equal(await readFile(path, "utf8"), "original");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
