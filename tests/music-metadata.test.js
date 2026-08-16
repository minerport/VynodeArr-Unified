import test from "node:test";
import assert from "node:assert/strict";
import {
  searchMusicArtists,
  loadMusicBrainzArtist,
  loadMusicBrainzReleaseGroup,
  testMusicMetadataProvider,
  enrichMusicArtist,
} from "../.server-build/packages/platform/src/music-metadata-connectors.js";

const response = (value) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const provider = {
  id: "metadata_musicbrainz",
  implementation: "musicbrainz",
  endpoint: "https://musicbrainz.test/ws/2",
  enabled: true,
};

test("MusicBrainz artist discovery preserves durable identity and disambiguation", async () => {
  let headers;
  const items = await searchMusicArtists({
    query: "The National",
    providers: [provider],
    fetcher: async (_url, options) => {
      headers = options.headers;
      return response({
        artists: [
          {
            id: "mbid-1",
            name: "The National",
            "sort-name": "National, The",
            disambiguation: "US indie rock band",
            country: "US",
            type: "Group",
            score: 100,
            tags: [{ name: "indie rock", count: 9 }],
          },
        ],
      });
    },
  });
  assert.equal(items[0].id, "mbid-1");
  assert.equal(items[0].disambiguation, "US indie rock band");
  assert.match(headers["user-agent"], /^VynodeArr\/2\.0\.50/);
});

test("MusicBrainz discography import keeps release-group identity and artist credits", async () => {
  let calls = 0;
  const value = await loadMusicBrainzArtist({
    artistId: "mbid-1",
    provider,
    fetcher: async () => {
      calls++;
      return calls === 1
        ? response({
            id: "mbid-1",
            name: "Artist",
            "sort-name": "Artist",
            genres: [{ name: "rock" }],
          })
        : response({
            "release-group-count": 1,
            "release-groups": [
              {
                id: "group-1",
                title: "Album",
                "primary-type": "Album",
                "first-release-date": "2024-01-02",
                "artist-credit": [
                  { name: "Artist", joinphrase: " feat. " },
                  { name: "Guest" },
                ],
              },
            ],
          });
    },
  });
  assert.equal(value.artist.id, "mbid-1");
  assert.equal(value.releaseGroups[0].artistCredit, "Artist feat. Guest");
});

test("Last.fm uses a user API key for optional artist enrichment", async () => {
  let url;
  const lastfm = {
    implementation: "lastfm",
    endpoint: "https://lastfm.test/2.0/",
    apiKey: "user-key",
  };
  await testMusicMetadataProvider(lastfm, {
    fetcher: async (value) => {
      url = new URL(value);
      return response({ artist: { name: "Cher" } });
    },
  });
  assert.equal(url.searchParams.get("api_key"), "user-key");
  const artist = await enrichMusicArtist({
    artist: { name: "Cher", foreignArtistId: "mbid", genres: [] },
    provider: lastfm,
    fetcher: async () =>
      response({
        artist: {
          bio: { summary: "Artist bio" },
          tags: { tag: [{ name: "pop" }] },
          stats: { listeners: "12" },
        },
      }),
  });
  assert.deepEqual(artist.genres, ["pop"]);
  assert.equal(artist.listeners, 12);
});

test("release-group loading ranks complete official editions and preserves discs and recordings", async () => {
  const value = await loadMusicBrainzReleaseGroup({
    releaseGroupId: "group-1",
    provider,
    fetcher: async () =>
      response({
        "release-count": 1,
        releases: [
          {
            id: "release-1",
            title: "Album",
            status: "Official",
            country: "US",
            date: "2024-01-01",
            media: [
              {
                position: 1,
                format: "Digital Media",
                "track-count": 1,
                tracks: [
                  {
                    id: "track-1",
                    position: 1,
                    number: "1",
                    title: "Song",
                    length: 180000,
                    recording: { id: "recording-1", isrcs: ["USABC123"] },
                    "artist-credit": [{ name: "Artist" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
  });
  assert.equal(value.selected.id, "release-1");
  assert.equal(value.selected.media[0].tracks[0].recordingId, "recording-1");
  assert.deepEqual(value.selected.media[0].tracks[0].isrcs, ["USABC123"]);
  assert.ok(value.selected.score >= 80);
});
