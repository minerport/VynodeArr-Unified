import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  downloadSubtitle,
  grabMusicRelease,
  pollMusicDownloads,
  searchNewznab,
  searchSubtitles,
  testMusicProvider,
} from "../.server-build/packages/platform/src/media-connectors.js";

async function server(handler, run) {
  const instance = createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  try {
    return await run(`http://127.0.0.1:${instance.address().port}`);
  } finally {
    await new Promise((resolve) => instance.close(resolve));
  }
}

test("Newznab and Torznab searches normalize music releases with explainable scores", () =>
  server(
    (req, res) => {
      assert.match(req.url, /t=search/);
      res.end(
        '<?xml version="1.0"?><rss><channel><item><title>Artist - Album FLAC</title><guid>release-1</guid><link>https://download.test/album.nzb</link><pubDate>Sun, 16 Aug 2026 12:00:00 GMT</pubDate><enclosure url="https://download.test/album.nzb" length="1234"/><torznab:attr name="seeders" value="12"/></item></channel></rss>',
      );
    },
    async (endpoint) => {
      const items = await searchNewznab({
        query: { artist: "Artist", album: "Album" },
        indexers: [
          {
            id: "indexer_1",
            name: "Search",
            endpoint,
            implementation: "torznab",
            apiKey: "key",
          },
        ],
      });
      assert.equal(items.length, 1);
      assert.equal(items[0].protocol, "torrent");
      assert.ok(items[0].reasons.some((value) => value.includes("lossless")));
      assert.ok(items[0].score > 0);
    },
  ));

test("SABnzbd testing and grabbing use its JSON API and configured music category", () =>
  server(
    (req, res) => {
      const url = new URL(req.url, "http://local");
      assert.equal(url.pathname, "/api");
      if (url.searchParams.get("mode") === "version")
        return res.end(JSON.stringify({ version: "4.5" }));
      assert.equal(url.searchParams.get("mode"), "addurl");
      assert.equal(url.searchParams.get("cat"), "music-vynode");
      res.end(JSON.stringify({ status: true, nzo_ids: ["job-1"] }));
    },
    async (endpoint) => {
      assert.deepEqual(
        (
          await testMusicProvider({
            implementation: "sabnzbd",
            endpoint,
            apiKey: "secret",
          })
        ).capabilities,
        ["usenet", "grab", "queue"],
      );
      const result = await grabMusicRelease({
        release: { downloadUrl: "https://download.test/release.nzb" },
        client: {
          implementation: "sabnzbd",
          endpoint,
          apiKey: "secret",
          categories: ["music-vynode"],
        },
      });
      assert.equal(result.id, "job-1");
    },
  ));

test("qBittorrent login and grab use a dedicated music category", () =>
  server(
    async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      if (req.url.endsWith("/api/v2/auth/login")) {
        assert.match(body, /username=user/);
        res.setHeader("set-cookie", "SID=session; HttpOnly");
        return res.end("Ok.");
      }
      assert.equal(req.url, "/api/v2/torrents/add");
      assert.match(req.headers.cookie, /SID=session/);
      assert.match(body, /category=music/);
      res.end("Ok.");
    },
    async (endpoint) => {
      const result = await grabMusicRelease({
        release: { id: "torrent-1", downloadUrl: "magnet:?xt=urn:btih:123" },
        client: {
          implementation: "qbittorrent",
          endpoint,
          username: "user",
          password: "pass",
          categories: ["music"],
        },
      });
      assert.equal(result.id, "torrent-1");
    },
  ));

test("SABnzbd history polling normalizes completed music output paths", () =>
  server(
    (req, res) => {
      const url = new URL(req.url, "http://local");
      assert.equal(url.searchParams.get("mode"), "history");
      assert.equal(url.searchParams.get("cat"), "music");
      res.end(
        JSON.stringify({
          history: {
            slots: [
              {
                nzo_id: "job-1",
                name: "Artist - Album",
                status: "Completed",
                storage: "/downloads/music/Artist - Album",
              },
            ],
          },
        }),
      );
    },
    async (endpoint) => {
      const items = await pollMusicDownloads({
        implementation: "sabnzbd",
        endpoint,
        apiKey: "secret",
        categories: ["music"],
      });
      assert.equal(items[0].status, "completed");
      assert.equal(items[0].outputPath, "/downloads/music/Artist - Album");
    },
  ));

test("OpenSubtitles search and download preserve episode identity and write beside media", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vynode-subtitle-")),
    media = join(directory, "Show.S01E02.mkv");
  await writeFile(media, "video");
  try {
    await server(
      async (req, res) => {
        let body = "";
        for await (const chunk of req) body += chunk;
        if (req.url === "/api/v1/login") {
          res.setHeader("content-type", "application/json");
          return res.end(JSON.stringify({ token: "token" }));
        }
        if (req.url.startsWith("/api/v1/subtitles")) {
          const url = new URL(req.url, "http://local");
          assert.equal(url.searchParams.get("season_number"), "1");
          assert.equal(url.searchParams.get("episode_number"), "2");
          res.setHeader("content-type", "application/json");
          return res.end(
            JSON.stringify({
              data: [
                {
                  id: "sub-1",
                  attributes: {
                    language: "fr",
                    release: "WEB",
                    ratings: 8,
                    files: [{ file_id: 99, file_name: "show.srt" }],
                  },
                },
              ],
            }),
          );
        }
        if (req.url === "/api/v1/download") {
          assert.match(body, /99/);
          res.setHeader("content-type", "application/json");
          return res.end(
            JSON.stringify({
              link: `http://127.0.0.1:${res.socket.localPort}/file`,
            }),
          );
        }
        if (req.url === "/file")
          return res.end("1\n00:00:00,000 --> 00:00:01,000\nBonjour\n");
        res.statusCode = 404;
        res.end();
      },
      async (endpoint) => {
        const provider = {
            id: "provider_1",
            name: "OpenSubtitles",
            implementation: "opensubtitles",
            endpoint,
            apiKey: "key",
            username: "user",
            password: "pass",
          },
          item = {
            id: "episode_2",
            domain: "episode",
            title: "Show",
            seasonNumber: 1,
            episodeNumber: 2,
            filePath: media,
          };
        const results = await searchSubtitles({
          item,
          languages: ["fr"],
          providers: [provider],
        });
        assert.equal(results[0].fileId, 99);
        const saved = await downloadSubtitle({
          item,
          provider,
          result: results[0],
        });
        assert.match(await readFile(saved.path, "utf8"), /Bonjour/);
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
