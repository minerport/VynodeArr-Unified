import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../.server-build/packages/platform/src/json-store.js";
import { MusicService } from "../.server-build/packages/platform/src/music-service.js";
import { SubtitleService } from "../.server-build/packages/platform/src/subtitle-service.js";
import { EncryptedCredentialVault } from "../.server-build/packages/platform/src/credential-vault.js";

async function fixture(name, initial, create) {
  const directory = await mkdtemp(join(tmpdir(), `vynode-${name}-`)),
    store = new JsonStore(join(directory, `${name}.json`), initial);
  return { directory, service: create(store) };
}

test("music providers stay domain-specific and secrets never appear in snapshots", async () => {
  const value = await fixture(
    "music",
    {
      version: 1,
      artists: [],
      albums: [],
      tracks: [],
      jobs: [],
      indexers: [],
      downloadClients: [],
    },
    (store) =>
      new MusicService({
        store,
        indexerTester: async () => ({ capabilities: ["music-search"] }),
        downloadClientTester: async () => ({ capabilities: ["grab"] }),
      }),
  );
  try {
    await value.service.saveProvider("indexer", {
      name: "Music Search",
      endpoint: "https://indexer.test",
      apiKey: "secret",
      implementation: "torznab",
    });
    await value.service.saveProvider("downloadClient", {
      name: "Downloads",
      endpoint: "https://client.test",
      password: "private",
      implementation: "sabnzbd",
    });
    const snapshot = await value.service.snapshot();
    assert.equal(snapshot.indexers.length, 1);
    assert.equal(snapshot.downloadClients.length, 1);
    assert.equal(JSON.stringify(snapshot).includes("secret"), false);
    assert.equal(JSON.stringify(snapshot).includes("private"), false);
    assert.deepEqual(
      (await value.service.testProvider("indexer", {})).capabilities,
      ["music-search"],
    );
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("media provider credentials are encrypted at rest and hydrated only for connectors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-media-vault-"));
  const store = new JsonStore(join(directory, "music.json"), {
    version: 1,
    indexers: [],
    downloadClients: [],
    artists: [],
    albums: [],
    tracks: [],
    jobs: [],
  });
  const vaultPath = join(directory, "media-provider-credentials.enc");
  const vault = new EncryptedCredentialVault(
    vaultPath,
    "a-long-media-provider-master-key",
  );
  let received;
  const service = new MusicService({
    store,
    vault,
    indexerTester: async (config) => {
      received = config.apiKey;
      return { reachable: true };
    },
  });
  try {
    const provider = await service.saveProvider("indexer", {
      name: "Private Search",
      endpoint: "https://indexer.test",
      apiKey: "top-secret-key",
    });
    assert.equal(
      JSON.stringify(await store.read()).includes("top-secret-key"),
      false,
    );
    assert.equal(
      (await readFile(vaultPath, "utf8")).includes("top-secret-key"),
      false,
    );
    await service.testProvider("indexer", { id: provider.id });
    assert.equal(received, "top-secret-key");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("music release search is explainable and grabs use the highest-priority enabled client", async () => {
  let selected;
  const value = await fixture(
    "music-search",
    {
      version: 1,
      artists: [],
      albums: [],
      tracks: [],
      jobs: [],
      indexers: [],
      downloadClients: [],
    },
    (store) =>
      new MusicService({
        store,
        searcher: async () => [
          { title: "Lossless", score: 90, reasons: ["preferred codec"] },
          { title: "Fallback", score: 20, reasons: ["lower quality"] },
        ],
        grabber: async (input) => {
          selected = input.client.name;
          return { id: "external-1" };
        },
      }),
  );
  try {
    await value.service.saveProvider("indexer", {
      name: "Search",
      endpoint: "https://search.test",
    });
    await value.service.saveProvider("downloadClient", {
      name: "Second",
      endpoint: "https://second.test",
      priority: 50,
    });
    await value.service.saveProvider("downloadClient", {
      name: "First",
      endpoint: "https://first.test",
      priority: 5,
    });
    const results = await value.service.search({
      artist: "Artist",
      album: "Album",
    });
    assert.equal(results.items[0].title, "Lossless");
    assert.deepEqual(results.items[0].reasons, ["preferred codec"]);
    const job = await value.service.grab({ title: "Artist - Album" });
    assert.equal(selected, "First");
    assert.equal(job.status, "sent");
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("subtitle policies inherit from series and can be overridden per episode", async () => {
  const value = await fixture(
    "subtitles",
    {
      version: 1,
      providers: [],
      profiles: [],
      assignments: [],
      items: [],
      jobs: [],
      history: [],
    },
    (store) => new SubtitleService({ store }),
  );
  try {
    const seriesProfile = await value.service.saveProfile({
        name: "English and Spanish",
        languages: ["en", "es"],
      }),
      episodeProfile = await value.service.saveProfile({
        name: "English only",
        languages: ["en"],
      });
    await value.service.assign({
      domain: "series",
      mediaId: "series_7",
      profileId: seriesProfile.id,
    });
    const first = await value.service.reconcile({
      domain: "episode",
      mediaId: "episode_71",
      seriesId: "series_7",
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Pilot",
      external: ["en"],
    });
    assert.deepEqual((await value.service.status(first)).missingLanguages, [
      "es",
    ]);
    await value.service.assign({
      domain: "episode",
      mediaId: "episode_71",
      profileId: episodeProfile.id,
    });
    assert.equal((await value.service.status(first)).complete, true);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("completed episode arrivals create one missing-language job per policy gap", async () => {
  const value = await fixture(
    "subtitle-arrival",
    {
      version: 1,
      providers: [],
      profiles: [],
      assignments: [],
      items: [],
      jobs: [],
      history: [],
    },
    (store) => new SubtitleService({ store }),
  );
  try {
    const profile = await value.service.saveProfile({
      name: "Family",
      languages: ["en", "fr"],
      forced: ["en"],
    });
    await value.service.assign({
      domain: "series",
      mediaId: "series_9",
      profileId: profile.id,
    });
    const result = await value.service.processMediaArrival({
      domain: "episode",
      mediaId: "episode_91",
      seriesId: "series_9",
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Arrival",
      embedded: ["en"],
    });
    assert.deepEqual(result.item.missingLanguages, ["fr"]);
    assert.equal(result.queued.length, 1);
    assert.equal((await value.service.snapshot()).jobs[0].language, "fr");
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("subtitle downloads update episode coverage and retain provider history", async () => {
  const value = await fixture(
    "subtitle-download",
    {
      version: 1,
      providers: [],
      profiles: [],
      assignments: [],
      items: [],
      jobs: [],
      history: [],
    },
    (store) =>
      new SubtitleService({
        store,
        downloader: async () => ({ path: "/tv/Show/S01E01.fr.srt" }),
      }),
  );
  try {
    const profile = await value.service.saveProfile({
        name: "French",
        languages: ["fr"],
      }),
      provider = await value.service.saveProvider({
        name: "Provider",
        endpoint: "https://subtitle.test",
      });
    await value.service.assign({
      domain: "series",
      mediaId: "series_1",
      profileId: profile.id,
    });
    const item = await value.service.reconcile({
      domain: "episode",
      mediaId: "episode_1",
      seriesId: "series_1",
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Pilot",
    });
    await value.service.download({
      itemId: item.id,
      providerId: provider.id,
      language: "fr",
    });
    const snapshot = await value.service.snapshot();
    assert.deepEqual(snapshot.items[0].external, ["fr"]);
    assert.equal(snapshot.history[0].provider, "Provider");
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("subtitle reconciliation detects existing language sidecars", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-sidecars-")),
    media = join(directory, "Show.S01E01.mkv");
  const store = new JsonStore(join(directory, "subtitles.json"), {
      version: 1,
      providers: [],
      profiles: [],
      assignments: [],
      items: [],
      jobs: [],
      history: [],
    }),
    service = new SubtitleService({ store });
  try {
    await writeFile(media, "video");
    await writeFile(join(directory, "Show.S01E01.en.srt"), "captions");
    const item = await service.reconcile({
      domain: "episode",
      mediaId: "episode_1",
      filePath: media,
    });
    assert.deepEqual(item.external, ["en"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("pending subtitle jobs can be retried and superseded after download", async () => {
  const value = await fixture(
    "subtitle-retry",
    {
      version: 1,
      providers: [],
      profiles: [],
      assignments: [],
      items: [],
      jobs: [],
      history: [],
    },
    (store) =>
      new SubtitleService({
        store,
        searcher: async ({ providers }) => [
          {
            id: "result-1",
            providerId: providers[0].id,
            language: "fr",
            score: 100,
          },
        ],
        downloader: async () => ({ path: "/tv/show.fr.srt" }),
      }),
  );
  try {
    const profile = await value.service.saveProfile({
        name: "French",
        languages: ["fr"],
      }),
      provider = await value.service.saveProvider({
        name: "Source",
        endpoint: "https://subtitle.test",
      });
    await value.service.assign({
      domain: "episode",
      mediaId: "episode_1",
      profileId: profile.id,
    });
    const item = await value.service.reconcile({
      domain: "episode",
      mediaId: "episode_1",
    });
    await value.service.processMediaArrival({
      ...item,
      domain: "episode",
      mediaId: "episode_1",
    });
    await value.service.store.update((state) => {
      state.items[0].external = [];
      state.jobs.unshift({
        id: "pending-1",
        itemId: item.id,
        language: "fr",
        status: "awaiting-search",
      });
    });
    const result = await value.service.retryPending();
    assert.equal(result.completed, 1);
    assert.equal(
      (await value.service.snapshot()).jobs.find(
        (job) => job.id === "pending-1",
      ).status,
      "superseded",
    );
    assert.ok(provider.id);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});
