import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

const timeout = (ms) => AbortSignal.timeout(ms);
const openSubtitlesTokens = new Map();
const endpoint = (value) => {
  const url = new URL(String(value || ""));
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new TypeError(
      "Provider endpoint must be an HTTP(S) URL without embedded credentials",
    );
  return url;
};
const limited = async (response, max = 8_000_000) => {
  if (!response.ok)
    throw new Error(`Provider request failed (${response.status})`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > max) throw new Error("Provider response is too large");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > max) throw new Error("Provider response is too large");
  return buffer;
};
const decodeXml = (value) =>
  String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
const tag = (xml, name) =>
  decodeXml(
    xml.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"),
    )?.[1] || "",
  );
const attr = (xml, name) =>
  decodeXml(xml.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] || "");
const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: options.signal || timeout(15_000),
    headers: { accept: "application/json", ...(options.headers || {}) },
  });
  const buffer = await limited(response);
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("Provider returned invalid JSON");
  }
};

export async function searchNewznab({ query, indexers }) {
  const results = [];
  for (const provider of indexers) {
    const url = endpoint(provider.endpoint);
    url.searchParams.set("t", "search");
    url.searchParams.set(
      "q",
      [query?.artist, query?.album, query?.term].filter(Boolean).join(" "),
    );
    if (provider.apiKey) url.searchParams.set("apikey", provider.apiKey);
    if (provider.categories?.length)
      url.searchParams.set("cat", provider.categories.join(","));
    const xml = (
      await limited(await fetch(url, { signal: timeout(15_000) }), 4_000_000)
    ).toString("utf8");
    for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
      const title = tag(item, "title"),
        link =
          tag(item, "link") ||
          attr(item.match(/<enclosure\b[^>]*>/i)?.[0] || "", "url"),
        size = Number(
          attr(item.match(/<enclosure\b[^>]*>/i)?.[0] || "", "length") ||
            tag(item, "size") ||
            0,
        ),
        seeders = Number(
          item.match(
            /(?:torznab|newznab):attr\s+name=["']seeders["']\s+value=["'](\d+)/i,
          )?.[1] || 0,
        ),
        ageHours = Math.max(
          0,
          (Date.now() -
            Date.parse(tag(item, "pubDate") || new Date().toISOString())) /
            36e5,
        ),
        lossless = /\b(flac|lossless)\b/i.test(title),
        score =
          (lossless ? 45 : 20) +
          Math.min(25, seeders) -
          Math.min(20, ageHours / 168);
      if (title && link)
        results.push({
          id: tag(item, "guid") || link,
          title,
          downloadUrl: link,
          indexerId: provider.id,
          indexer: provider.name,
          size,
          seeders,
          ageHours: Math.round(ageHours),
          protocol:
            provider.implementation === "newznab" ? "usenet" : "torrent",
          score: Math.round(score),
          reasons: [
            lossless ? "lossless format" : "compressed format",
            seeders ? `${seeders} seeders` : "availability not reported",
            `${Math.round(ageHours)} hours old`,
          ],
        });
    }
  }
  return results;
}

export async function testMusicProvider(input) {
  const implementation = String(input.implementation || "").toLowerCase();
  if (["newznab", "torznab"].includes(implementation)) {
    const url = endpoint(input.endpoint);
    url.searchParams.set("t", "caps");
    if (input.apiKey) url.searchParams.set("apikey", input.apiKey);
    await limited(await fetch(url, { signal: timeout(10_000) }), 1_000_000);
    return { capabilities: ["search", "rss", implementation] };
  }
  if (implementation === "sabnzbd") {
    const url = endpoint(input.endpoint);
    url.pathname = url.pathname.replace(/\/$/, "") + "/api";
    url.search = new URLSearchParams({
      mode: "version",
      output: "json",
      apikey: input.apiKey || "",
    });
    await requestJson(url);
    return { capabilities: ["usenet", "grab", "queue"] };
  }
  if (implementation === "nzbget") {
    await nzbget(input, "version", []);
    return { capabilities: ["usenet", "grab", "queue"] };
  }
  if (implementation === "qbittorrent") {
    await qbitLogin(input);
    return { capabilities: ["torrent", "grab", "category"] };
  }
  throw new Error("Unsupported provider implementation");
}

async function qbitLogin(client) {
  const url = endpoint(client.endpoint);
  url.pathname = url.pathname.replace(/\/$/, "") + "/api/v2/auth/login";
  const response = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({
      username: client.username || "",
      password: client.password || "",
    }),
    signal: timeout(10_000),
  });
  if (!response.ok || (await response.text()).trim() !== "Ok.")
    throw new Error("qBittorrent authentication failed");
  return response.headers.get("set-cookie")?.split(";")[0] || "";
}
async function nzbget(client, method, params) {
  const url = endpoint(client.endpoint);
  url.pathname = url.pathname.replace(/\/$/, "") + "/jsonrpc";
  const auth = Buffer.from(
    `${client.username || "nzbget"}:${client.password || ""}`,
  ).toString("base64");
  const value = await requestJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ method, params, id: 1 }),
  });
  if (value.error)
    throw new Error(value.error.message || "NZBGet request failed");
  return value.result;
}

export async function grabMusicRelease({ release, client }) {
  const implementation = String(client.implementation || "").toLowerCase(),
    source = String(release.downloadUrl || release.url || "");
  if (!source) throw new Error("Release download URL is required");
  if (implementation === "sabnzbd") {
    const url = endpoint(client.endpoint);
    url.pathname = url.pathname.replace(/\/$/, "") + "/api";
    url.search = new URLSearchParams({
      mode: "addurl",
      name: source,
      output: "json",
      apikey: client.apiKey || "",
      cat: client.categories?.[0] || "music",
    });
    const value = await requestJson(url);
    if (value.status === false)
      throw new Error(value.error || "SABnzbd rejected the release");
    return { id: value.nzo_ids?.[0] || value.nzo_id || null };
  }
  if (implementation === "qbittorrent") {
    const cookie = await qbitLogin(client),
      url = endpoint(client.endpoint);
    url.pathname = url.pathname.replace(/\/$/, "") + "/api/v2/torrents/add";
    const response = await fetch(url, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        urls: source,
        category: client.categories?.[0] || "music",
      }),
      signal: timeout(15_000),
    });
    await limited(response, 100_000);
    return { id: release.id || source };
  }
  if (implementation === "nzbget") {
    const data = (
        await limited(
          await fetch(source, { signal: timeout(20_000) }),
          20_000_000,
        )
      ).toString("base64"),
      name =
        basename(new URL(source).pathname) || `${release.title || "music"}.nzb`,
      id = await nzbget(client, "append", [
        name,
        data,
        client.categories?.[0] || "music",
        0,
        false,
        false,
        [],
        0,
        "SCORE",
      ]);
    return { id: String(id) };
  }
  throw new Error("Unsupported music download client");
}

export async function pollMusicDownloads(client) {
  const implementation = String(client.implementation || "").toLowerCase(),
    category = client.categories?.[0] || "music";
  if (implementation === "sabnzbd") {
    const url = endpoint(client.endpoint);
    url.pathname = url.pathname.replace(/\/$/, "") + "/api";
    url.search = new URLSearchParams({
      mode: "history",
      output: "json",
      apikey: client.apiKey || "",
      cat: category,
      limit: "100",
    });
    const value = await requestJson(url);
    return (value.history?.slots || []).map((item) => ({
      id: String(item.nzo_id || item.id || ""),
      name: item.name || item.nzb_name || "",
      status: /completed/i.test(item.status)
        ? "completed"
        : /fail/i.test(item.status)
          ? "failed"
          : "downloading",
      outputPath: item.storage || item.path || null,
      error: item.fail_message || null,
    }));
  }
  if (implementation === "qbittorrent") {
    const cookie = await qbitLogin(client),
      url = endpoint(client.endpoint);
    url.pathname = url.pathname.replace(/\/$/, "") + "/api/v2/torrents/info";
    url.search = new URLSearchParams({ category });
    const items = await requestJson(url, { headers: { cookie } });
    return (items || []).map((item) => ({
      id: String(item.hash || ""),
      name: item.name || "",
      status:
        item.progress >= 1
          ? "completed"
          : /error|missing/i.test(item.state)
            ? "failed"
            : "downloading",
      outputPath:
        item.progress >= 1 ? item.content_path || item.save_path || null : null,
      error: /error|missing/i.test(item.state) ? item.state : null,
    }));
  }
  if (implementation === "nzbget") {
    const [active, history] = await Promise.all([
      nzbget(client, "listgroups", []),
      nzbget(client, "history", [false]),
    ]);
    return [
      ...(active || []).map((item) => ({
        id: String(item.NZBID),
        name: item.NZBName || "",
        status: "downloading",
        outputPath: null,
        error: null,
      })),
      ...(history || [])
        .filter((item) => !category || item.Category === category)
        .map((item) => ({
          id: String(item.NZBID),
          name: item.Name || item.NZBName || "",
          status: /SUCCESS/i.test(item.Status) ? "completed" : "failed",
          outputPath: item.FinalDir || item.DestDir || null,
          error: /SUCCESS/i.test(item.Status) ? null : item.Status,
        })),
    ];
  }
  throw new Error("Unsupported music download client");
}

async function openSubtitlesToken(provider) {
  if (provider.token) return provider.token;
  const key = `${provider.endpoint || "https://api.opensubtitles.com"}:${provider.username || ""}`,
    cached = openSubtitlesTokens.get(key);
  if (cached?.expiresAt > Date.now()) return cached.token;
  const url = endpoint(provider.endpoint || "https://api.opensubtitles.com");
  url.pathname = "/api/v1/login";
  const value = await requestJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-key": provider.apiKey || "",
      "user-agent": "VynodeArr v2",
    },
    body: JSON.stringify({
      username: provider.username,
      password: provider.password,
    }),
  });
  if (!value.token) throw new Error("OpenSubtitles authentication failed");
  openSubtitlesTokens.set(key, {
    token: value.token,
    expiresAt: Date.now() + 23 * 60 * 60_000,
  });
  return value.token;
}
export async function testSubtitleProvider(input) {
  if (input.implementation === "whisper") {
    const url = endpoint(input.endpoint);
    url.pathname = url.pathname.replace(/\/$/, "") + "/health";
    await limited(await fetch(url, { signal: timeout(10_000) }), 500_000);
    return { languages: [], capabilities: ["transcribe", "episode", "movie"] };
  }
  const token = await openSubtitlesToken(input);
  return {
    languages: [],
    capabilities: ["search", "download", "episode", "movie"],
    tokenPresent: Boolean(token),
  };
}
export async function searchSubtitles({ item, languages, providers }) {
  const results = [];
  for (const provider of providers) {
    if (provider.implementation === "whisper") {
      for (const language of languages)
        results.push({
          id: `whisper:${item.id}:${language}`,
          providerId: provider.id,
          provider: provider.name,
          language,
          score: 45,
          hearingImpaired: false,
          machineGenerated: true,
          reasons: ["generated locally from the media file"],
        });
      continue;
    }
    const token = await openSubtitlesToken(provider),
      url = endpoint(provider.endpoint || "https://api.opensubtitles.com");
    url.pathname = "/api/v1/subtitles";
    url.searchParams.set("languages", languages.join(","));
    if (item.domain === "episode") {
      if (item.episodeNumber != null)
        url.searchParams.set("episode_number", String(item.episodeNumber));
      if (item.seasonNumber != null)
        url.searchParams.set("season_number", String(item.seasonNumber));
    }
    if (item.title) url.searchParams.set("query", item.title);
    const value = await requestJson(url, {
      headers: {
        "api-key": provider.apiKey || "",
        authorization: `Bearer ${token}`,
        "user-agent": "VynodeArr v2",
      },
    });
    for (const entry of value.data || []) {
      const attributes = entry.attributes || {},
        file = attributes.files?.[0];
      if (!file?.file_id) continue;
      results.push({
        id: String(entry.id),
        fileId: file.file_id,
        fileName: file.file_name,
        providerId: provider.id,
        provider: provider.name,
        language: attributes.language,
        release: attributes.release,
        hearingImpaired: Boolean(attributes.hearing_impaired),
        score:
          Number(attributes.ratings || 0) * 10 +
          Number(attributes.download_count || 0) / 1000,
        reasons: [
          attributes.release || "provider match",
          attributes.hearing_impaired
            ? "hearing-impaired release"
            : "standard release",
        ],
      });
    }
  }
  return results;
}

export async function downloadSubtitle({ item, provider, result }) {
  if (!item.filePath)
    throw new Error("The media file path is required to save a subtitle");
  const language = String(result.language || "und").toLowerCase(),
    stem = basename(item.filePath, extname(item.filePath)),
    target = join(dirname(item.filePath), `${stem}.${language}.srt`);
  let bytes;
  if (provider.implementation === "whisper") {
    const url = endpoint(provider.endpoint);
    url.pathname = url.pathname.replace(/\/$/, "") + "/asr";
    url.searchParams.set("output", "srt");
    url.searchParams.set("language", language);
    const media = await readFile(item.filePath),
      form = new FormData();
    form.append("audio_file", new Blob([media]), basename(item.filePath));
    bytes = await limited(
      await fetch(url, {
        method: "POST",
        body: form,
        signal: timeout(30 * 60_000),
      }),
      20_000_000,
    );
  } else {
    const token = await openSubtitlesToken(provider),
      url = endpoint(provider.endpoint || "https://api.opensubtitles.com");
    url.pathname = "/api/v1/download";
    const value = await requestJson(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": provider.apiKey || "",
        authorization: `Bearer ${token}`,
        "user-agent": "VynodeArr v2",
      },
      body: JSON.stringify({ file_id: Number(result.fileId) }),
    });
    bytes = await limited(
      await fetch(value.link, { signal: timeout(30_000) }),
      20_000_000,
    );
  }
  await writeFile(target, bytes, { mode: 0o644 });
  return { path: target };
}
