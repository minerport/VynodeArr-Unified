import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../.server-build/packages/platform/src/json-store.js";
import { MusicImportService } from "../.server-build/packages/platform/src/music-import-service.js";

test("music imports are constrained, reviewed, copied, and recorded without deleting downloads", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-music-import-")),
    downloads = join(directory, "downloads"),
    library = join(directory, "library"),
    release = join(downloads, "Artist - Album");
  await mkdir(release, { recursive: true });
  await writeFile(join(release, "01 - First.flac"), "one");
  await writeFile(join(release, "02 - Second.flac"), "two");
  const store = new JsonStore(join(directory, "music.json"), {
      version: 1,
      artists: [{ id: "artist_1", name: "Artist" }],
      albums: [{ id: "album_1", artistId: "artist_1", title: "Album" }],
      tracks: [
        {
          id: "track_1",
          albumId: "album_1",
          title: "First",
          mediumNumber: 1,
          trackNumber: 1,
        },
        {
          id: "track_2",
          albumId: "album_1",
          title: "Second",
          mediumNumber: 1,
          trackNumber: 2,
        },
      ],
      jobs: [],
    }),
    service = new MusicImportService({ store });
  try {
    await service.settings({ downloadPath: downloads, libraryRoot: library });
    const review = await service.analyze({
      albumId: "album_1",
      sourcePath: release,
    });
    assert.equal(review.ready, true);
    assert.equal(review.matches[0].confidence, 90);
    const result = await service.execute({
      albumId: "album_1",
      sourcePath: release,
    });
    assert.equal(result.imported.length, 2);
    assert.equal(
      await readFile(join(release, "01 - First.flac"), "utf8"),
      "one",
    );
    assert.equal(await readFile(result.imported[0].filePath, "utf8"), "one");
    assert.equal((await store.read()).albums[0].availableTrackCount, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("music import rejects folders outside the configured completed-download root", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-music-boundary-")),
    downloads = join(directory, "downloads"),
    outside = join(directory, "outside"),
    library = join(directory, "library");
  await mkdir(downloads, { recursive: true });
  await mkdir(outside, { recursive: true });
  const store = new JsonStore(join(directory, "music.json"), {
      version: 1,
      artists: [],
      albums: [],
      tracks: [],
    }),
    service = new MusicImportService({ store });
  try {
    await service.settings({ downloadPath: downloads, libraryRoot: library });
    await assert.rejects(
      () => service.analyze({ albumId: "missing", sourcePath: outside }),
      /inside the configured music download folder/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("music import review enforces the artist quality profile", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-music-quality-")),
    downloads = join(directory, "downloads"),
    library = join(directory, "library"),
    release = join(downloads, "Release");
  await mkdir(release, { recursive: true });
  await writeFile(join(release, "01 - First.mp3"), "audio");
  const store = new JsonStore(join(directory, "music.json"), {
      artists: [{ id: "artist_1", name: "Artist", qualityProfile: "Lossless" }],
      albums: [{ id: "album_1", artistId: "artist_1", title: "Album" }],
      tracks: [{ id: "track_1", albumId: "album_1", title: "First", mediumNumber: 1, trackNumber: 1 }],
      qualityProfiles: [{ id: "quality_1", name: "Lossless", allowLossy: false, allowLossless: true }],
    }),
    service = new MusicImportService({
      store,
      inspector: async () => ({ codec: "mp3", bitrate: 320000, sampleRate: 44100, bitDepth: null }),
    });
  try {
    await service.settings({ downloadPath: downloads, libraryRoot: library });
    const review = await service.analyze({ albumId: "album_1", sourcePath: release });
    assert.equal(review.ready, false);
    assert.equal(review.qualityProfile.name, "Lossless");
    assert.equal(review.matches[0].qualityAccepted, false);
    assert.match(review.matches[0].qualityReasons[0], /Lossy audio/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("music import removes partial copies when a later copy fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-music-atomic-")),
    downloads = join(directory, "downloads"),
    library = join(directory, "library"),
    release = join(downloads, "Release");
  await mkdir(release, { recursive: true });
  await writeFile(join(release, "01 - First.flac"), "one");
  await writeFile(join(release, "02 - Second.flac"), "two");
  const store = new JsonStore(join(directory, "music.json"), {
      artists: [{ id: "artist_1", name: "Artist" }],
      albums: [{ id: "album_1", artistId: "artist_1", title: "Album" }],
      tracks: [
        { id: "track_1", albumId: "album_1", title: "First", mediumNumber: 1, trackNumber: 1 },
        { id: "track_2", albumId: "album_1", title: "Second", mediumNumber: 1, trackNumber: 2 },
      ],
    });
  let copies = 0;
  const service = new MusicImportService({
    store,
    inspector: async () => null,
    copier: async (source, target) => {
      copies += 1;
      if (copies === 2) throw new Error("disk full");
      await writeFile(target, await readFile(source));
    },
  });
  try {
    await service.settings({ downloadPath: downloads, libraryRoot: library });
    await assert.rejects(
      () => service.execute({ albumId: "album_1", sourcePath: release }),
      /disk full/,
    );
    await assert.rejects(
      () => readFile(join(library, "Artist", "Album", "01 - First.flac")),
      /ENOENT/,
    );
    assert.equal((await store.read()).tracks[0].hasFile, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
