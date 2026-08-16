import { randomUUID } from "node:crypto";

const text = (value, max = 240) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const now = () => new Date().toISOString();
const publicProvider = (provider) => ({
  id: provider.id,
  name: provider.name,
  type: provider.type,
  implementation: provider.implementation,
  enabled: provider.enabled,
  priority: provider.priority,
  categories: provider.categories || [],
  capabilities: provider.capabilities || [],
  configured: Boolean(provider.endpoint),
});
const secretFields = ["apiKey", "username", "password"];

export class MusicService {
  constructor({
    store,
    vault = null,
    indexerTester = null,
    downloadClientTester = null,
    searcher = null,
    grabber = null,
  }) {
    this.store = store;
    this.vault = vault;
    this.indexerTester = indexerTester;
    this.downloadClientTester = downloadClientTester;
    this.searcher = searcher;
    this.grabber = grabber;
  }
  async #credentials(provider) {
    if (!provider) return provider;
    return {
      ...provider,
      ...(this.vault ? await this.vault.get(`music:${provider.id}`) : null),
    };
  }
  async #migrate() {
    if (!this.vault) return;
    const state = await this.store.read(),
      providers = [
        ...(state.indexers || []),
        ...(state.downloadClients || []),
      ].filter((provider) => secretFields.some((field) => provider[field]));
    if (!providers.length) return;
    for (const provider of providers) {
      const credentials = Object.fromEntries(
        secretFields
          .map((field) => [field, provider[field]])
          .filter(([, value]) => value),
      );
      await this.vault.replace(`music:${provider.id}`, {
        ...((await this.vault.get(`music:${provider.id}`)) || {}),
        ...credentials,
      });
    }
    await this.store.update((value) => {
      for (const key of ["indexers", "downloadClients"])
        for (const provider of value[key] || [])
          for (const field of secretFields) delete provider[field];
    });
  }
  async snapshot() {
    await this.#migrate();
    const state = await this.store.read();
    return {
      artists: state.artists || [],
      albums: state.albums || [],
      tracks: state.tracks || [],
      jobs: state.jobs || [],
      indexers: (state.indexers || []).map(publicProvider),
      downloadClients: (state.downloadClients || []).map(publicProvider),
    };
  }
  async saveProvider(type, input) {
    if (!["indexer", "downloadClient"].includes(type))
      throw new TypeError("Unsupported music provider type");
    const key = type === "indexer" ? "indexers" : "downloadClients",
      record = {
        id: text(input.id) || `${type}_${randomUUID()}`,
        name: text(input.name, 80),
        type,
        implementation: text(input.implementation, 40) || "torznab",
        endpoint: text(input.endpoint, 500),
        enabled: input.enabled !== false,
        priority: Math.max(1, Math.min(100, Number(input.priority) || 25)),
        categories: Array.isArray(input.categories)
          ? input.categories.map((value) => text(value, 40)).filter(Boolean)
          : [],
        capabilities: Array.isArray(input.capabilities)
          ? input.capabilities.map((value) => text(value, 40)).filter(Boolean)
          : [],
        updatedAt: now(),
      },
      credentials = Object.fromEntries(
        secretFields
          .map((field) => [
            field,
            text(input[field], field === "username" ? 160 : 500),
          ])
          .filter(([, value]) => value),
      );
    if (!record.name || !record.endpoint)
      throw new TypeError("Provider name and endpoint are required");
    await this.store.update((state) => {
      state[key] ||= [];
      const index = state[key].findIndex((item) => item.id === record.id);
      if (index >= 0) state[key][index] = { ...state[key][index], ...record };
      else state[key].push(record);
      state.updatedAt = record.updatedAt;
    });
    if (this.vault && Object.keys(credentials).length)
      await this.vault.replace(`music:${record.id}`, {
        ...((await this.vault.get(`music:${record.id}`)) || {}),
        ...credentials,
      });
    return publicProvider(record);
  }
  async removeProvider(type, id) {
    const key =
      type === "indexer"
        ? "indexers"
        : type === "downloadClient"
          ? "downloadClients"
          : null;
    if (!key) throw new TypeError("Unsupported music provider type");
    const removed = await this.store.update((state) => {
      const before = (state[key] || []).length;
      state[key] = (state[key] || []).filter((item) => item.id !== id);
      return before !== state[key].length;
    });
    if (removed && this.vault) await this.vault.remove(`music:${id}`);
    return removed;
  }
  async testProvider(type, input) {
    const tester =
      type === "indexer" ? this.indexerTester : this.downloadClientTester;
    if (!tester)
      return {
        reachable: false,
        compatible: false,
        message: "No connector is installed for this provider implementation.",
      };
    let config = input;
    if (input?.id) {
      const state = await this.store.read(),
        items = type === "indexer" ? state.indexers : state.downloadClients;
      config = (items || []).find((item) => item.id === input.id);
      if (!config) throw new Error("Music provider was not found");
      config = await this.#credentials(config);
    }
    const started = Date.now(),
      result = await tester(config);
    return {
      reachable: result?.reachable !== false,
      compatible: result?.compatible !== false,
      capabilities: result?.capabilities || [],
      latencyMs: Date.now() - started,
      message: result?.message || "Connection successful.",
    };
  }
  async saveArtist(input) {
    const artist = {
      id: text(input.id) || `artist_${randomUUID()}`,
      name: text(input.name, 160),
      sortName: text(input.sortName || input.name, 160),
      foreignArtistId: text(input.foreignArtistId, 120) || null,
      overview: text(input.overview, 2000),
      genres: Array.isArray(input.genres)
        ? input.genres.map((value) => text(value, 80)).filter(Boolean)
        : [],
      monitored: input.monitored !== false,
      monitorMode: ["all", "future", "missing", "none"].includes(
        input.monitorMode,
      )
        ? input.monitorMode
        : "all",
      qualityProfile: text(input.qualityProfile, 100) || "Any",
      path: text(input.path, 500) || null,
      artwork: text(input.artwork, 1000) || null,
      addedAt: input.addedAt || now(),
      updatedAt: now(),
    };
    if (!artist.name) throw new TypeError("Artist name is required");
    await this.store.update((state) => {
      state.artists ||= [];
      const index = state.artists.findIndex((item) => item.id === artist.id);
      if (index >= 0)
        state.artists[index] = { ...state.artists[index], ...artist };
      else state.artists.push(artist);
      state.updatedAt = artist.updatedAt;
    });
    return artist;
  }
  async saveAlbum(input) {
    const album = {
      id: text(input.id) || `album_${randomUUID()}`,
      artistId: text(input.artistId),
      title: text(input.title, 240),
      releaseDate: input.releaseDate || null,
      releaseType: text(input.releaseType, 40) || "album",
      monitored: input.monitored !== false,
      trackCount: Math.max(0, Number(input.trackCount) || 0),
      availableTrackCount: Math.max(0, Number(input.availableTrackCount) || 0),
      quality: text(input.quality, 100) || null,
      artwork: text(input.artwork, 1000) || null,
      updatedAt: now(),
    };
    if (!album.artistId || !album.title)
      throw new TypeError("Album artist and title are required");
    await this.store.update((state) => {
      state.albums ||= [];
      const index = state.albums.findIndex((item) => item.id === album.id);
      if (index >= 0)
        state.albums[index] = { ...state.albums[index], ...album };
      else state.albums.push(album);
    });
    return album;
  }
  async search(query) {
    const state = await this.store.read(),
      indexers = await Promise.all(
        (state.indexers || [])
          .filter((item) => item.enabled !== false)
          .sort((a, b) => a.priority - b.priority)
          .map((item) => this.#credentials(item)),
      );
    if (!indexers.length)
      return {
        items: [],
        warnings: ["Configure and enable at least one music indexer."],
      };
    if (!this.searcher)
      return {
        items: [],
        warnings: [
          "No search connector is installed for the configured indexers.",
        ],
      };
    const raw = await this.searcher({ query, indexers });
    const items = (raw || [])
      .map((item) => ({
        ...item,
        score: Number(item.score || 0),
        reasons: Array.isArray(item.reasons) ? item.reasons : [],
      }))
      .sort((a, b) => b.score - a.score);
    return { items, warnings: [] };
  }
  async grab(input) {
    const state = await this.store.read(),
      client = await this.#credentials(
        (state.downloadClients || [])
          .filter((item) => item.enabled !== false)
          .sort((a, b) => a.priority - b.priority)[0],
      );
    if (!client)
      throw new Error(
        "Configure and enable a music download client before grabbing releases",
      );
    if (!this.grabber)
      throw new Error(
        "No grab connector is installed for the configured download client",
      );
    const job = {
      id: `music_job_${randomUUID()}`,
      kind: "grab",
      title: text(input.title, 240) || "Music release",
      artistId: text(input.artistId) || null,
      albumId: text(input.albumId) || null,
      status: "queued",
      downloadClientId: client.id,
      createdAt: now(),
      updatedAt: now(),
    };
    await this.store.update((value) => {
      value.jobs ||= [];
      value.jobs.unshift(job);
    });
    try {
      const result = await this.grabber({ release: input, client });
      job.status = "sent";
      job.externalId = text(result?.id, 160) || null;
      job.updatedAt = now();
    } catch (error) {
      job.status = "failed";
      job.error = text(error?.message || error, 500);
      job.updatedAt = now();
      throw error;
    } finally {
      await this.store.update((value) => {
        const index = (value.jobs || []).findIndex(
          (item) => item.id === job.id,
        );
        if (index >= 0) value.jobs[index] = job;
      });
    }
    return job;
  }
}
