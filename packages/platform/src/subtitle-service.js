import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";

const text = (value, max = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const now = () => new Date().toISOString();
const normalizeLanguages = (values) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => text(value, 20).toLowerCase())
      .filter(Boolean),
  ),
];
const publicProvider = (value) => ({
  id: value.id,
  name: value.name,
  implementation: value.implementation,
  enabled: value.enabled,
  priority: value.priority,
  capabilities: value.capabilities || [],
  configured: Boolean(value.endpoint),
});
const secretFields = ["apiKey", "username", "password"];
const subtitleExtensions = new Set([".srt", ".ass", ".ssa", ".vtt", ".sub"]);
async function sidecarLanguages(filePath) {
  if (!filePath) return [];
  try {
    const stem = basename(filePath, extname(filePath)).toLowerCase(),
      files = await readdir(dirname(filePath));
    return normalizeLanguages(
      files.flatMap((file) => {
        const extension = extname(file).toLowerCase();
        if (!subtitleExtensions.has(extension)) return [];
        const candidate = basename(file, extension).toLowerCase();
        if (!candidate.startsWith(`${stem}.`)) return [];
        const suffix = candidate.slice(stem.length + 1).split(".")[0];
        return suffix && suffix.length <= 20 ? [suffix] : [];
      }),
    );
  } catch {
    return [];
  }
}

export class SubtitleService {
  constructor({
    store,
    vault = null,
    providerTester = null,
    searcher = null,
    downloader = null,
  }) {
    this.store = store;
    this.vault = vault;
    this.providerTester = providerTester;
    this.searcher = searcher;
    this.downloader = downloader;
  }
  async #credentials(provider) {
    if (!provider) return provider;
    return {
      ...provider,
      ...(this.vault ? await this.vault.get(`subtitle:${provider.id}`) : null),
    };
  }
  async #migrate() {
    if (!this.vault) return;
    const state = await this.store.read(),
      providers = (state.providers || []).filter((provider) =>
        secretFields.some((field) => provider[field]),
      );
    if (!providers.length) return;
    for (const provider of providers) {
      const credentials = Object.fromEntries(
        secretFields
          .map((field) => [field, provider[field]])
          .filter(([, value]) => value),
      );
      await this.vault.replace(`subtitle:${provider.id}`, {
        ...((await this.vault.get(`subtitle:${provider.id}`)) || {}),
        ...credentials,
      });
    }
    await this.store.update((value) => {
      for (const provider of value.providers || [])
        for (const field of secretFields) delete provider[field];
    });
  }
  async snapshot() {
    await this.#migrate();
    const state = await this.store.read();
    return {
      providers: (state.providers || []).map(publicProvider),
      profiles: state.profiles || [],
      assignments: state.assignments || [],
      items: state.items || [],
      jobs: state.jobs || [],
      history: state.history || [],
    };
  }
  async saveProvider(input) {
    const record = {
        id: text(input.id) || `subtitle_provider_${randomUUID()}`,
        name: text(input.name, 80),
        implementation: text(input.implementation, 60) || "opensubtitles",
        endpoint: text(input.endpoint, 500),
        enabled: input.enabled !== false,
        priority: Math.max(1, Math.min(100, Number(input.priority) || 25)),
        capabilities: Array.isArray(input.capabilities)
          ? input.capabilities.map((value) => text(value, 40))
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
      state.providers ||= [];
      const index = state.providers.findIndex((item) => item.id === record.id);
      if (index >= 0)
        state.providers[index] = { ...state.providers[index], ...record };
      else state.providers.push(record);
    });
    if (this.vault && Object.keys(credentials).length)
      await this.vault.replace(`subtitle:${record.id}`, {
        ...((await this.vault.get(`subtitle:${record.id}`)) || {}),
        ...credentials,
      });
    return publicProvider(record);
  }
  async removeProvider(id) {
    const removed = await this.store.update((state) => {
      const before = (state.providers || []).length;
      state.providers = (state.providers || []).filter(
        (item) => item.id !== id,
      );
      return before !== state.providers.length;
    });
    if (removed && this.vault) await this.vault.remove(`subtitle:${id}`);
    return removed;
  }
  async testProvider(input) {
    if (!this.providerTester)
      return {
        reachable: false,
        compatible: false,
        message: "No connector is installed for this subtitle provider.",
      };
    let config = input;
    if (input?.id) {
      const state = await this.store.read();
      config = (state.providers || []).find((item) => item.id === input.id);
      if (!config) throw new Error("Subtitle provider was not found");
      config = await this.#credentials(config);
    }
    const started = Date.now(),
      result = await this.providerTester(config);
    return {
      reachable: result?.reachable !== false,
      compatible: result?.compatible !== false,
      languages: normalizeLanguages(result?.languages),
      latencyMs: Date.now() - started,
      message: result?.message || "Connection successful.",
    };
  }
  async saveProfile(input) {
    const profile = {
      id: text(input.id) || `subtitle_profile_${randomUUID()}`,
      name: text(input.name, 100),
      languages: normalizeLanguages(input.languages),
      forced: normalizeLanguages(input.forced),
      hearingImpaired: ["prefer", "include", "exclude"].includes(
        input.hearingImpaired,
      )
        ? input.hearingImpaired
        : "include",
      upgradeUntilScore: Number(input.upgradeUntilScore) || null,
      enabled: input.enabled !== false,
      updatedAt: now(),
    };
    if (!profile.name || !profile.languages.length)
      throw new TypeError(
        "Profile name and at least one language are required",
      );
    await this.store.update((state) => {
      state.profiles ||= [];
      const index = state.profiles.findIndex((item) => item.id === profile.id);
      if (index >= 0) state.profiles[index] = profile;
      else state.profiles.push(profile);
    });
    return profile;
  }
  async assign(input) {
    const assignment = {
      id: text(input.id) || `subtitle_assignment_${randomUUID()}`,
      domain: ["movie", "series", "season", "episode"].includes(input.domain)
        ? input.domain
        : "series",
      mediaId: text(input.mediaId, 180),
      profileId: text(input.profileId, 180),
      enabled: input.enabled !== false,
      updatedAt: now(),
    };
    if (!assignment.mediaId || !assignment.profileId)
      throw new TypeError("Media and subtitle profile are required");
    await this.store.update((state) => {
      state.assignments ||= [];
      const index = state.assignments.findIndex(
        (item) =>
          item.domain === assignment.domain &&
          item.mediaId === assignment.mediaId,
      );
      if (index >= 0)
        state.assignments[index] = {
          ...state.assignments[index],
          ...assignment,
        };
      else state.assignments.push(assignment);
    });
    return assignment;
  }
  async reconcile(input) {
    const detectedExternal = await sidecarLanguages(text(input.filePath, 1000));
    const item = {
      id: `${input.domain}_${text(input.mediaId, 160)}`,
      domain: input.domain,
      mediaId: text(input.mediaId, 160),
      seriesId: text(input.seriesId, 160) || null,
      seasonNumber: Number.isFinite(Number(input.seasonNumber))
        ? Number(input.seasonNumber)
        : null,
      episodeNumber: Number.isFinite(Number(input.episodeNumber))
        ? Number(input.episodeNumber)
        : null,
      title: text(input.title, 240),
      filePath: text(input.filePath, 1000) || null,
      embedded: normalizeLanguages(input.embedded),
      external: normalizeLanguages([
        ...(Array.isArray(input.external) ? input.external : []),
        ...detectedExternal,
      ]),
      updatedAt: now(),
    };
    await this.store.update((state) => {
      state.items ||= [];
      const index = state.items.findIndex((value) => value.id === item.id);
      if (index >= 0) state.items[index] = { ...state.items[index], ...item };
      else state.items.push(item);
    });
    return item;
  }
  async status(item) {
    const state = await this.store.read(),
      assignment = this.#assignment(state, item),
      profile = (state.profiles || []).find(
        (value) => value.id === assignment?.profileId,
      ),
      present = new Set([
        ...normalizeLanguages(item.embedded),
        ...normalizeLanguages(item.external),
      ]),
      required = profile?.languages || [],
      missing = required.filter((language) => !present.has(language));
    return {
      ...item,
      profile: profile || null,
      requiredLanguages: required,
      presentLanguages: [...present],
      missingLanguages: missing,
      complete: Boolean(profile) && missing.length === 0,
    };
  }
  #assignment(state, item) {
    const assignments = (state.assignments || []).filter(
        (value) => value.enabled !== false,
      ),
      keys = [
        ["episode", item.mediaId],
        [
          "season",
          item.seriesId && item.seasonNumber != null
            ? `${item.seriesId}:season:${item.seasonNumber}`
            : null,
        ],
        ["series", item.seriesId],
        ["movie", item.domain === "movie" ? item.mediaId : null],
      ];
    for (const [domain, id] of keys) {
      const found = assignments.find(
        (value) => value.domain === domain && value.mediaId === id,
      );
      if (found) return found;
    }
    return null;
  }
  async search(input) {
    const state = await this.store.read(),
      item = (state.items || []).find((value) => value.id === input.itemId);
    if (!item) throw new Error("Subtitle media item was not found");
    const status = await this.status(item),
      providers = await Promise.all(
        (state.providers || [])
          .filter((value) => value.enabled !== false)
          .sort((a, b) => a.priority - b.priority)
          .map((value) => this.#credentials(value)),
      );
    if (!status.profile)
      return {
        items: [],
        warnings: ["Assign a subtitle profile to this title or episode."],
      };
    if (!providers.length)
      return {
        items: [],
        warnings: ["Configure and enable at least one subtitle provider."],
      };
    if (!this.searcher)
      return {
        items: [],
        warnings: [
          "No search connector is installed for the configured subtitle providers.",
        ],
      };
    const results = await this.searcher({
      item: status,
      languages: input.languages?.length
        ? normalizeLanguages(input.languages)
        : status.missingLanguages,
      providers,
    });
    return {
      items: (results || []).sort(
        (a, b) => Number(b.score || 0) - Number(a.score || 0),
      ),
      warnings: [],
    };
  }
  async download(input) {
    const state = await this.store.read(),
      item = (state.items || []).find((value) => value.id === input.itemId),
      provider = await this.#credentials(
        (state.providers || []).find(
          (value) => value.id === input.providerId && value.enabled !== false,
        ),
      );
    if (!item || !provider)
      throw new Error("Subtitle item or provider was not found");
    if (!this.downloader)
      throw new Error(
        "No download connector is installed for the configured subtitle provider",
      );
    const job = {
      id: `subtitle_job_${randomUUID()}`,
      itemId: item.id,
      providerId: provider.id,
      language: text(input.language, 20).toLowerCase(),
      status: "downloading",
      createdAt: now(),
      updatedAt: now(),
    };
    await this.store.update((value) => {
      value.jobs ||= [];
      value.jobs.unshift(job);
    });
    try {
      const result = await this.downloader({ item, provider, result: input });
      job.status = "completed";
      job.path = text(result?.path, 1000) || null;
      await this.store.update((value) => {
        const media = value.items.find((entry) => entry.id === item.id);
        if (media && !media.external.includes(job.language))
          media.external.push(job.language);
        value.history ||= [];
        value.history.unshift({
          id: `subtitle_history_${randomUUID()}`,
          jobId: job.id,
          itemId: item.id,
          provider: provider.name,
          language: job.language,
          path: job.path,
          createdAt: now(),
        });
      });
    } catch (error) {
      job.status = "failed";
      job.error = text(error?.message || error);
      throw error;
    } finally {
      job.updatedAt = now();
      await this.store.update((value) => {
        const index = value.jobs.findIndex((entry) => entry.id === job.id);
        if (index >= 0) value.jobs[index] = job;
      });
    }
    return job;
  }
  async processMediaArrival(input) {
    const item = await this.reconcile(input),
      status = await this.status(item);
    if (!status.missingLanguages.length)
      return { item: status, queued: [], downloaded: [] };
    const queued = [],
      downloaded = [];
    for (const language of status.missingLanguages) {
      try {
        const results = await this.search({
            itemId: item.id,
            languages: [language],
          }),
          best = results.items?.[0];
        if (best) {
          downloaded.push(
            await this.download({
              ...best,
              itemId: item.id,
              providerId: best.providerId,
              language,
            }),
          );
          continue;
        }
        queued.push({
          itemId: item.id,
          language,
          status: "awaiting-search",
          reason: results.warnings?.[0] || "No matching subtitle was found",
        });
      } catch (error) {
        queued.push({
          itemId: item.id,
          language,
          status: "awaiting-search",
          reason: text(error?.message || error),
        });
      }
    }
    if (queued.length)
      await this.store.update((state) => {
        state.jobs ||= [];
        for (const job of queued)
          state.jobs.unshift({
            id: `subtitle_job_${randomUUID()}`,
            ...job,
            createdAt: now(),
            updatedAt: now(),
          });
      });
    return {
      item: await this.status(
        (await this.store.read()).items.find((value) => value.id === item.id) ||
          item,
      ),
      queued,
      downloaded,
    };
  }
  async retryPending({ limit = 50, respectSchedule = false } = {}) {
    const state = await this.store.read(),
      pending = (state.jobs || []).filter(
        (job) =>
          job.status === "awaiting-search" &&
          (!respectSchedule || !job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= Date.now()),
      ).slice(0, Math.max(1, Math.min(200, Number(limit) || 50))),
      completed = [],
      failed = [];
    for (const job of pending) {
      try {
        const results = await this.search({
            itemId: job.itemId,
            languages: [job.language],
          }),
          best = results.items?.[0];
        if (!best) {
          failed.push({
            id: job.id,
            reason: results.warnings?.[0] || "No matching subtitle was found",
          });
          continue;
        }
        await this.download({
          ...best,
          itemId: job.itemId,
          providerId: best.providerId,
          language: job.language,
        });
        completed.push(job.id);
      } catch (error) {
        failed.push({ id: job.id, reason: text(error?.message || error) });
      }
    }
    if (completed.length || failed.length)
      await this.store.update((value) => {
        for (const job of value.jobs || [])
          if (completed.includes(job.id)) {
            job.status = "superseded";
            job.updatedAt = now();
          } else {
            const failure = failed.find((entry) => entry.id === job.id);
            if (!failure) continue;
            job.attempts = Number(job.attempts || 0) + 1;
            job.lastError = failure.reason;
            job.lastAttemptAt = now();
            job.nextAttemptAt = new Date(
              Date.now() + Math.min(24, 2 ** Math.min(job.attempts, 5)) * 36e5,
            ).toISOString();
            job.updatedAt = now();
          }
      });
    return { attempted: pending.length, completed: completed.length, failed };
  }
}
