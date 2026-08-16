const clean = (value) => String(value ?? "").trim();
const endpoint = (value, fallback) =>
  clean(value).replace(/\/+$/, "") || fallback;
const json = async (response, label) => {
  if (!response.ok)
    throw new Error(`${label} returned HTTP ${response.status}`);
  return response.json();
};
let musicBrainzNextRequest = 0;
const musicBrainzWait = async () => {
  const delay = Math.max(0, musicBrainzNextRequest - Date.now());
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  musicBrainzNextRequest = Date.now() + 1100;
};
const artistCredit = (value) =>
  (value?.["artist-credit"] || [])
    .map(
      (part) =>
        `${part.name || part.artist?.name || ""}${part.joinphrase || ""}`,
    )
    .join("")
    .trim();

async function musicBrainzRequest(provider, path, fetcher) {
  await musicBrainzWait();
  const response = await fetcher(
    `${endpoint(provider.endpoint, "https://musicbrainz.org/ws/2")}${path}`,
    {
      headers: {
        accept: "application/json",
        "user-agent":
          "VynodeArr/2.0.50 (https://github.com/minerport/VynodeArr-Unified)",
      },
    },
  );
  return json(response, "MusicBrainz");
}

export async function testMusicMetadataProvider(
  provider,
  { fetcher = globalThis.fetch } = {},
) {
  if (provider.implementation === "lastfm") {
    if (!provider.apiKey) throw new Error("A Last.fm API key is required");
    const url = new URL(
      endpoint(provider.endpoint, "https://ws.audioscrobbler.com/2.0/"),
    );
    url.searchParams.set("method", "artist.getinfo");
    url.searchParams.set("artist", "Cher");
    url.searchParams.set("api_key", provider.apiKey);
    url.searchParams.set("format", "json");
    const value = await json(await fetcher(url), "Last.fm");
    if (value.error)
      throw new Error(value.message || "Last.fm rejected the API key");
    return {
      reachable: true,
      compatible: true,
      capabilities: ["artist-enrichment", "album-enrichment", "tags"],
    };
  }
  const value = await musicBrainzRequest(
    provider,
    "/artist?query=artist%3A%22Cher%22&limit=1&fmt=json",
    fetcher,
  );
  return {
    reachable: true,
    compatible: Array.isArray(value.artists),
    capabilities: [
      "artist-search",
      "discography",
      "release-editions",
      "track-metadata",
    ],
  };
}

export async function searchMusicArtists({
  query,
  providers,
  fetcher = globalThis.fetch,
}) {
  const authoritative = providers.find(
    (provider) =>
      provider.enabled !== false && provider.implementation === "musicbrainz",
  );
  if (!authoritative)
    throw new Error(
      "Enable a MusicBrainz metadata provider before searching for artists",
    );
  const params = new URLSearchParams({
      query: `artist:${clean(query)}`,
      limit: "20",
      fmt: "json",
    }),
    value = await musicBrainzRequest(
      authoritative,
      `/artist?${params}`,
      fetcher,
    );
  return (value.artists || []).map((artist) => ({
    id: artist.id,
    name: artist.name,
    sortName: artist["sort-name"] || artist.name,
    disambiguation: artist.disambiguation || "",
    country: artist.country || null,
    type: artist.type || null,
    lifeSpan: artist["life-span"] || null,
    score: Number(artist.score) || 0,
    genres: (artist.tags || [])
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 8)
      .map((tag) => tag.name),
  }));
}

export async function loadMusicBrainzArtist({
  artistId,
  provider,
  fetcher = globalThis.fetch,
}) {
  const artist = await musicBrainzRequest(
      provider,
      `/artist/${encodeURIComponent(artistId)}?inc=genres+url-rels&fmt=json`,
      fetcher,
    ),
    groups = [];
  let offset = 0;
  do {
    const page = await musicBrainzRequest(
        provider,
        `/release-group?artist=${encodeURIComponent(artistId)}&type=album|ep|single&limit=100&offset=${offset}&inc=artist-credits+genres&fmt=json`,
        fetcher,
      ),
      records = page["release-groups"] || [];
    groups.push(...records);
    offset += records.length;
    if (!records.length || offset >= Number(page["release-group-count"] || 0))
      break;
  } while (true);
  return {
    artist: {
      id: artist.id,
      name: artist.name,
      sortName: artist["sort-name"] || artist.name,
      overview: artist.disambiguation || "",
      genres: (artist.genres || []).map((value) => value.name),
      country: artist.country || null,
      type: artist.type || null,
    },
    releaseGroups: groups.map((group) => ({
      id: group.id,
      title: group.title,
      artistCredit: artistCredit(group),
      primaryType: group["primary-type"] || "Other",
      secondaryTypes: group["secondary-types"] || [],
      firstReleaseDate: group["first-release-date"] || null,
      genres: (group.genres || []).map((value) => value.name),
    })),
  };
}

export async function enrichMusicArtist({
  artist,
  provider,
  fetcher = globalThis.fetch,
}) {
  if (!provider?.apiKey) return artist;
  const url = new URL(
    endpoint(provider.endpoint, "https://ws.audioscrobbler.com/2.0/"),
  );
  for (const [key, value] of Object.entries({
    method: "artist.getinfo",
    artist: artist.name,
    mbid: artist.foreignArtistId,
    api_key: provider.apiKey,
    format: "json",
    autocorrect: "1",
  }))
    if (value) url.searchParams.set(key, value);
  const result = await json(await fetcher(url), "Last.fm"),
    data = result.artist;
  if (!data || result.error) return artist;
  return {
    ...artist,
    overview:
      clean(data.bio?.summary)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() || artist.overview,
    genres: [
      ...new Set([
        ...(artist.genres || []),
        ...(data.tags?.tag || []).map((tag) => tag.name).filter(Boolean),
      ]),
    ],
    metadataLinks: {
      ...(artist.metadataLinks || {}),
      lastfm: data.url || null,
    },
    listeners: Number(data.stats?.listeners) || null,
    playCount: Number(data.stats?.playcount) || null,
  };
}
