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
    metadataProviderTester = null,
    artistSearcher = null,
    artistLoader = null,
    artistEnricher = null,
    albumLoader = null,
    searcher = null,
    grabber = null,
    downloadPoller = null,
    importer = null,
  }) {
    this.store = store;
    this.vault = vault;
    this.indexerTester = indexerTester;
    this.downloadClientTester = downloadClientTester;
    this.metadataProviderTester = metadataProviderTester;
    this.artistSearcher = artistSearcher;
    this.artistLoader = artistLoader;
    this.artistEnricher = artistEnricher;
    this.albumLoader = albumLoader;
    this.searcher = searcher;
    this.grabber = grabber;
    this.downloadPoller = downloadPoller;
    this.importer = importer;
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
        ...(state.metadataProviders || []),
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
      for (const key of ["indexers", "downloadClients", "metadataProviders"])
        for (const provider of value[key] || [])
          for (const field of secretFields) delete provider[field];
    });
  }
  async snapshot() {
    await this.#migrate();
    let state = await this.store.read();
    if (!Array.isArray(state.metadataProviders))
      state = await this.store.update((value) => {
        value.metadataProviders = [
          {
            id: "metadata_musicbrainz",
            name: "MusicBrainz",
            type: "metadata",
            implementation: "musicbrainz",
            endpoint: "https://musicbrainz.org/ws/2",
            enabled: true,
            priority: 1,
            capabilities: ["artist-search", "discography"],
          },
        ];
        return value;
      });
    return {
      artists: state.artists || [],
      albums: state.albums || [],
      editions: state.editions || [],
      tracks: state.tracks || [],
      jobs: state.jobs || [],
      qualityProfiles: state.qualityProfiles || [],
      indexers: (state.indexers || []).map(publicProvider),
      downloadClients: (state.downloadClients || []).map(publicProvider),
      metadataProviders: (state.metadataProviders || []).map(publicProvider),
    };
  }
  async saveProvider(type, input) {
    if (!["indexer", "downloadClient", "metadata"].includes(type))
      throw new TypeError("Unsupported music provider type");
    const key =
        type === "indexer"
          ? "indexers"
          : type === "downloadClient"
            ? "downloadClients"
            : "metadataProviders",
      record = {
        id: text(input.id) || `${type}_${randomUUID()}`,
        name: text(input.name, 80),
        type,
        implementation:
          text(input.implementation, 40) ||
          (type === "metadata" ? "musicbrainz" : "torznab"),
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
          : type === "metadata"
            ? "metadataProviders"
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
      type === "indexer"
        ? this.indexerTester
        : type === "downloadClient"
          ? this.downloadClientTester
          : this.metadataProviderTester;
    if (!tester)
      return {
        reachable: false,
        compatible: false,
        message: "No connector is installed for this provider implementation.",
      };
    let config = input;
    if (input?.id) {
      const state = await this.store.read(),
        items =
          type === "indexer"
            ? state.indexers
            : type === "downloadClient"
              ? state.downloadClients
              : state.metadataProviders;
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
  async searchArtists(query) {
    if (!this.artistSearcher)
      throw new Error("No music metadata search connector is installed");
    const state = await this.store.read(),
      providers = await Promise.all(
        (state.metadataProviders || [])
          .filter((value) => value.enabled !== false)
          .sort((a, b) => a.priority - b.priority)
          .map((value) => this.#credentials(value)),
      );
    if (!providers.some((value) => value.implementation === "musicbrainz"))
      return {
        items: [],
        warnings: [
          "Configure and enable MusicBrainz before searching for artists.",
        ],
      };
    return {
      items: await this.artistSearcher({ query: text(query, 160), providers }),
      warnings: [],
    };
  }
  async addArtistFromMetadata(input) {
    if (!this.artistLoader)
      throw new Error("No music metadata loader is installed");
    const state = await this.store.read(),
      providers = await Promise.all(
        (state.metadataProviders || [])
          .filter((value) => value.enabled !== false)
          .sort((a, b) => a.priority - b.priority)
          .map((value) => this.#credentials(value)),
      ),
      authoritative = providers.find(
        (value) => value.implementation === "musicbrainz",
      );
    if (!authoritative)
      throw new Error("Enable MusicBrainz before adding an artist");
    const loaded = await this.artistLoader({
      artistId: text(input.artistId, 120),
      provider: authoritative,
    });
    let artist = {
      ...loaded.artist,
      id: `artist_${loaded.artist.id}`,
      foreignArtistId: loaded.artist.id,
      path: text(input.path, 500) || null,
      monitored: input.monitored !== false,
      monitorMode: ["all", "future", "missing", "none"].includes(
        input.monitorMode,
      )
        ? input.monitorMode
        : "all",
      qualityProfile: text(input.qualityProfile, 100) || "Any",
      addedAt: now(),
      updatedAt: now(),
    };
    const enrichment = providers.find(
      (value) => value.implementation === "lastfm",
    );
    if (enrichment && this.artistEnricher)
      artist = await this.artistEnricher({ artist, provider: enrichment });
    const albums = loaded.releaseGroups.map((group) => ({
      id: `album_${group.id}`,
      artistId: artist.id,
      foreignReleaseGroupId: group.id,
      title: group.title,
      artistCredit: group.artistCredit,
      releaseDate: group.firstReleaseDate,
      releaseType: group.primaryType.toLowerCase(),
      secondaryTypes: group.secondaryTypes,
      genres: group.genres,
      monitored: input.monitorMode !== "none",
      trackCount: 0,
      availableTrackCount: 0,
      quality: null,
      artwork: `https://coverartarchive.org/release-group/${group.id}/front-500`,
      updatedAt: now(),
    }));
    await this.store.update((value) => {
      value.artists ||= [];
      value.albums ||= [];
      const existing = value.artists.findIndex(
        (entry) => entry.foreignArtistId === artist.foreignArtistId,
      );
      if (existing >= 0)
        value.artists[existing] = {
          ...value.artists[existing],
          ...artist,
          id: value.artists[existing].id,
        };
      else value.artists.push(artist);
      const artistId = existing >= 0 ? value.artists[existing].id : artist.id;
      for (const album of albums) {
        album.artistId = artistId;
        const index = value.albums.findIndex(
          (entry) =>
            entry.foreignReleaseGroupId === album.foreignReleaseGroupId,
        );
        if (index >= 0)
          value.albums[index] = { ...value.albums[index], ...album };
        else value.albums.push(album);
      }
      value.updatedAt = now();
    });
    return { artist, albumCount: albums.length };
  }
  async refreshAlbumMetadata(albumId) {
    if (!this.albumLoader)
      throw new Error("No album metadata loader is installed");
    const state = await this.store.read(),
      album = (state.albums || []).find((value) => value.id === albumId);
    if (!album?.foreignReleaseGroupId)
      throw new Error("The album has no MusicBrainz release-group identity");
    const providers = await Promise.all(
        (state.metadataProviders || [])
          .filter((value) => value.enabled !== false)
          .sort((a, b) => a.priority - b.priority)
          .map((value) => this.#credentials(value)),
      ),
      provider = providers.find(
        (value) => value.implementation === "musicbrainz",
      );
    if (!provider)
      throw new Error("Enable MusicBrainz before refreshing an album");
    const loaded = await this.albumLoader({
        releaseGroupId: album.foreignReleaseGroupId,
        provider,
      }),
      selected = loaded.selected;
    await this.store.update((value) => {
      value.editions ||= [];
      value.tracks ||= [];
      value.editions = value.editions.filter(
        (entry) => entry.albumId !== album.id,
      );
      value.editions.push(
        ...loaded.editions.map((edition) => ({
          ...edition,
          id: `edition_${edition.id}`,
          foreignReleaseId: edition.id,
          albumId: album.id,
          selected: edition.id === selected?.id,
          updatedAt: now(),
        })),
      );
      value.tracks = value.tracks.filter((entry) => entry.albumId !== album.id);
      if (selected)
        for (const medium of selected.media)
          for (const track of medium.tracks)
            value.tracks.push({
              id: `track_${track.id || track.recordingId || randomUUID()}`,
              albumId: album.id,
              editionId: `edition_${selected.id}`,
              foreignTrackId: track.id || null,
              foreignRecordingId: track.recordingId,
              title: track.title,
              mediumNumber: medium.position,
              trackNumber: track.position,
              number: track.number,
              durationMs: track.lengthMs,
              artistCredit: track.artistCredit,
              isrcs: track.isrcs,
              monitored: album.monitored !== false,
              hasFile: false,
              updatedAt: now(),
            });
      const index = value.albums.findIndex((entry) => entry.id === album.id);
      if (index >= 0)
        value.albums[index] = {
          ...value.albums[index],
          selectedEditionId: selected ? `edition_${selected.id}` : null,
          trackCount: selected?.trackCount || 0,
          metadataRefreshedAt: now(),
          updatedAt: now(),
        };
      value.updatedAt = now();
    });
    return {
      albumId: album.id,
      editionCount: loaded.editions.length,
      selectedEditionId: selected ? `edition_${selected.id}` : null,
      trackCount: selected?.trackCount || 0,
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
  async saveQualityProfile(input) {
    const profile = {
      id: text(input.id) || `music_quality_${randomUUID()}`,
      name: text(input.name, 100),
      allowLossy: input.allowLossy !== false,
      allowLossless: input.allowLossless !== false,
      minBitrateKbps: Math.max(0, Number(input.minBitrateKbps) || 0),
      minSampleRate: Math.max(0, Number(input.minSampleRate) || 0),
      minBitDepth: Math.max(0, Number(input.minBitDepth) || 0),
      preferredCodecs: Array.isArray(input.preferredCodecs)
        ? input.preferredCodecs
            .map((value) => text(value, 30).toLowerCase())
            .filter(Boolean)
        : [],
      upgradeUntil: text(input.upgradeUntil, 40) || null,
      updatedAt: now(),
    };
    if (!profile.name || (!profile.allowLossy && !profile.allowLossless))
      throw new TypeError(
        "Quality profile name and at least one allowed class are required",
      );
    await this.store.update((state) => {
      state.qualityProfiles ||= [];
      const index = state.qualityProfiles.findIndex(
        (value) => value.id === profile.id,
      );
      if (index >= 0) state.qualityProfiles[index] = profile;
      else state.qualityProfiles.push(profile);
    });
    return profile;
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
  async searchMonitoredMissing({ limit = 3, minScore = 0, cooldownHours = 24 } = {}) {
    const state = await this.store.read(),
      artists = new Map((state.artists || []).map((value) => [value.id, value])),
      cutoff = Date.now() - Math.max(1, Number(cooldownHours) || 24) * 36e5,
      candidates = (state.albums || [])
        .filter((album) => {
          const artist = artists.get(album.artistId),
            missing = Number(album.trackCount || 0) > Number(album.availableTrackCount || 0),
            recent = (state.jobs || []).some(
              (job) =>
                job.albumId === album.id &&
                ["queued", "sent", "downloading", "completed", "import-review", "imported"].includes(job.status) &&
                Date.parse(job.createdAt || 0) >= cutoff,
            );
          return album.monitored !== false && artist?.monitored !== false && missing && !recent;
        })
        .slice(0, Math.max(1, Math.min(25, Number(limit) || 3))),
      searched = [],
      grabbed = [],
      skipped = [];
    for (const album of candidates) {
      const artist = artists.get(album.artistId),
        query = `${artist.name} ${album.title}`,
        result = await this.search(query),
        best = result.items.find((item) => Number(item.score || 0) >= Number(minScore || 0));
      searched.push({ albumId: album.id, query, resultCount: result.items.length });
      if (!best) {
        skipped.push({ albumId: album.id, reason: result.warnings[0] || "No eligible release was found" });
        continue;
      }
      try {
        grabbed.push(
          await this.grab({
            ...best,
            title: best.title || `${artist.name} - ${album.title}`,
            artistId: artist.id,
            albumId: album.id,
          }),
        );
      } catch (error) {
        skipped.push({ albumId: album.id, reason: text(error?.message || error, 500) });
      }
    }
    return { candidates: candidates.length, searched, grabbed, skipped };
  }
  async pollDownloads() {
    if (!this.downloadPoller)
      throw new Error("No music download polling connector is installed");
    const state = await this.store.read(),
      clients = await Promise.all(
        (state.downloadClients || [])
          .filter((value) => value.enabled !== false)
          .map((value) => this.#credentials(value)),
      ),
      updates = [],
      imports = [];
    for (const client of clients) {
      const remote = await this.downloadPoller(client);
      for (const job of (state.jobs || []).filter(
        (value) =>
          value.kind === "grab" &&
          value.downloadClientId === client.id &&
          !["imported", "failed"].includes(value.status),
      )) {
        const item = remote.find(
          (value) =>
            String(value.id) === String(job.externalId) ||
            (value.name &&
              job.title &&
              value.name.toLowerCase().includes(job.title.toLowerCase())),
        );
        if (!item) continue;
        updates.push({
          jobId: job.id,
          status: item.status,
          error: item.error || null,
          outputPath: item.outputPath || null,
        });
        if (
          item.status === "completed" &&
          item.outputPath &&
          job.albumId &&
          this.importer
        ) {
          try {
            const result = await this.importer.execute({
              albumId: job.albumId,
              sourcePath: item.outputPath,
            });
            imports.push({ jobId: job.id, ...result });
            updates[updates.length - 1].status = "imported";
          } catch (error) {
            updates[updates.length - 1].status = "import-review";
            updates[updates.length - 1].error = text(
              error?.message || error,
              500,
            );
          }
        }
      }
    }
    if (updates.length)
      await this.store.update((value) => {
        for (const update of updates) {
          const job = (value.jobs || []).find(
            (entry) => entry.id === update.jobId,
          );
          if (job) Object.assign(job, update, { updatedAt: now() });
        }
      });
    return { checked: clients.length, updates, imports };
  }
}
