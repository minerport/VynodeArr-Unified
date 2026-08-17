import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../.server-build/packages/platform/src/json-store.js";
import { MusicImportService } from "../.server-build/packages/platform/src/music-import-service.js";

test("music storage folders can be configured independently", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-music-settings-")),
    store = new JsonStore(join(directory, "music.json"), { version: 1 }),
    service = new MusicImportService({ store });
  try {
    const libraryOnly = await service.settings({ libraryRoot: join(directory, "library") });
    assert.equal(libraryOnly.downloadPath, "");
    assert.equal(libraryOnly.libraryRoot, join(directory, "library"));
    const completed = await service.settings({ downloadPath: join(directory, "downloads") });
    assert.equal(completed.libraryRoot, join(directory, "library"));
    assert.equal(completed.downloadPath, join(directory, "downloads"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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

test("music library scans reconcile exact embedded identities and missing tracks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-music-scan-")),
    downloads = join(directory, "downloads"),
    library = join(directory, "library"),
    file = join(library, "existing.flac");
  await mkdir(downloads, { recursive: true });
  await mkdir(library, { recursive: true });
  await writeFile(file, "audio");
  const store = new JsonStore(join(directory, "music.json"), {
      artists: [{ id: "artist", name: "Artist" }],
      albums: [{ id: "album", artistId: "artist", title: "Album", trackCount: 2, availableTrackCount: 2 }],
      tracks: [
        { id: "one", albumId: "album", foreignRecordingId: "recording-1", hasFile: false },
        { id: "two", albumId: "album", foreignRecordingId: "recording-2", hasFile: true, filePath: join(library, "gone.flac") },
      ],
    }),
    service = new MusicImportService({
      store,
      inspector: async (path) => ({ path, codec: "flac", musicBrainzRecordingId: "recording-1" }),
    });
  try {
    await service.settings({ downloadPath: downloads, libraryRoot: library });
    const result = await service.scanLibrary();
    assert.equal(result.scanned, 1);
    assert.equal(result.matched, 1);
    const state = await store.read();
    assert.equal(state.tracks[0].filePath, file);
    assert.equal(state.tracks[1].hasFile, false);
    assert.equal(state.albums[0].availableTrackCount, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("music library scans bound unmatched output for existing unmanaged libraries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-music-unmatched-")),
    library = join(directory, "library");
  await mkdir(library, { recursive: true });
  await Promise.all(Array.from({ length: 205 }, (_, index) => writeFile(join(library, `${index}.mp3`), "audio")));
  const store = new JsonStore(join(directory, "music.json"), { artists: [], albums: [], tracks: [] }),
    service = new MusicImportService({ store, inspector: async (path) => ({ path, codec: "mp3" }) });
  try {
    await service.settings({ libraryRoot: library });
    const result = await service.scanLibrary();
    assert.equal(result.scanned, 205);
    assert.equal(result.unmatchedCount, 205);
    assert.equal(result.unmatched.length, 200);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("music library scans discover tagged artists albums and tracks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-music-discovery-")), library = join(directory, "library"), file = join(library, "Artist", "Album", "01 - Song.flac");
  await mkdir(join(library, "Artist", "Album"), { recursive: true });
  await writeFile(file, "audio");
  const store = new JsonStore(join(directory, "music.json"), { artists: [], albums: [], tracks: [] }), service = new MusicImportService({ store, inspector: async path => ({ path, codec: "flac", artist: "Artist", album: "Album", title: "Song", trackNumber: 1 }) });
  try {
    await service.settings({ libraryRoot: library });
    const result = await service.scanLibrary();
    assert.equal(result.scanned, 1);
    assert.equal(result.matched, 1);
    assert.equal(result.imported, 1);
    assert.equal(result.unmatchedCount, 0);
    const state = await store.read();
    assert.equal(state.artists[0].name, "Artist");
    assert.equal(state.albums[0].title, "Album");
    assert.equal(state.tracks[0].filePath, file);
    assert.equal(state.tracks[0].hasFile, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
