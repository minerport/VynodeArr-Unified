import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const compose = ["compose", "-f", "infrastructure/testing/compose.multi-engine.yaml"];
const command = (executable, args) => {
  const result = spawnSync(executable, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${executable} ${args.join(" ")} failed`);
};
const run = (...args) => {
  const result = spawnSync("docker", [...compose, ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`docker compose ${args.join(" ")} failed`);
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(url, headers = {}) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(url, { headers })).ok) return; } catch {}
    await pause(2_000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
async function json(url, options = {}) {
  const response = await fetch(url, options);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${url}: ${JSON.stringify(value)}`);
  return { response, value };
}
const engineHeaders = (key) => ({ "x-api-key": key, "content-type": "application/json" });
async function allowDisposableLabMetadata(base, headers) {
  const host = (await json(`${base}/config/host`, { headers })).value;
  if (String(host.certificateValidation || "").toLowerCase() !== "disabled")
    await json(`${base}/config/host/${host.id}`, { method: "PUT", headers, body: JSON.stringify({ ...host, certificateValidation: "disabled" }) });
}
async function seedMovie(port, key, root, term) {
  const base = `http://127.0.0.1:${port}/api/v3`, headers = engineHeaders(key);
  await allowDisposableLabMetadata(base, headers);
  const roots = (await json(`${base}/rootfolder`, { headers })).value;
  if (!roots.some((item) => item.path === root)) await json(`${base}/rootfolder`, { method: "POST", headers, body: JSON.stringify({ path: root }) });
  const tags = (await json(`${base}/tag`, { headers })).value;
  if (!tags.some((item) => item.label === "shared-name")) await json(`${base}/tag`, { method: "POST", headers, body: JSON.stringify({ label: "shared-name" }) });
  const profile = (await json(`${base}/qualityprofile`, { headers })).value[0];
  const movie = (await json(`${base}/movie/lookup?term=${encodeURIComponent(term)}`, { headers })).value[0];
  const current = (await json(`${base}/movie`, { headers })).value;
  if (!current.some((item) => item.tmdbId === movie.tmdbId)) await json(`${base}/movie`, { method: "POST", headers, body: JSON.stringify({ ...movie, qualityProfileId: profile.id, rootFolderPath: root, monitored: false, addOptions: { searchForMovie: false } }) });
}
async function seedSeries(port, key, root, term) {
  const base = `http://127.0.0.1:${port}/api/v3`, headers = engineHeaders(key);
  await allowDisposableLabMetadata(base, headers);
  const roots = (await json(`${base}/rootfolder`, { headers })).value;
  if (!roots.some((item) => item.path === root)) await json(`${base}/rootfolder`, { method: "POST", headers, body: JSON.stringify({ path: root }) });
  const profile = (await json(`${base}/qualityprofile`, { headers })).value[0];
  const series = (await json(`${base}/series/lookup?term=${encodeURIComponent(term)}`, { headers })).value[0];
  const current = (await json(`${base}/series`, { headers })).value;
  if (!current.some((item) => item.tvdbId === series.tvdbId)) await json(`${base}/series`, { method: "POST", headers, body: JSON.stringify({ ...series, qualityProfileId: profile.id, rootFolderPath: root, monitored: false, seasonFolder: true, addOptions: { searchForMissingEpisodes: false } }) });
}

try {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run this integration through npm so its CLI path is available");
  command(process.execPath, [npmCli, "run", "build:server"]);
  command(process.execPath, [npmCli, "run", "build:web"]);
  run("down", "--volumes", "--remove-orphans");
  run("up", "-d");
  await Promise.all([
    waitFor("http://127.0.0.1:17878/ping"), waitFor("http://127.0.0.1:27878/ping"),
    waitFor("http://127.0.0.1:18989/ping"), waitFor("http://127.0.0.1:28989/ping"),
    waitFor("http://127.0.0.1:18686/ping"),
  ]);
  await seedMovie(17878, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "/movies-a", "tmdb:550");
  await seedMovie(27878, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "/movies-b", "tmdb:680");
  await seedSeries(18989, "cccccccccccccccccccccccccccccccc", "/tv-a", "tvdb:73739");
  await seedSeries(28989, "dddddddddddddddddddddddddddddddd", "/tv-b", "tvdb:81189");

  const app = "http://127.0.0.1:18686";
  const setup = await json(`${app}/api/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Lab Administrator", username: "labadmin", email: "lab@example.test", password: "Strong-lab-pass1", confirmPassword: "Strong-lab-pass1" }) });
  const cookie = setup.response.headers.get("set-cookie").split(";")[0];
  const mutationHeaders = { cookie, "x-vynodearr-csrf": setup.value.csrf, "content-type": "application/json" };
  const readHeaders = { cookie };
  const specifications = [
    ["movie", "Movies A", "radarr-a", 7878, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["movie", "Movies B", "radarr-b", 7878, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
    ["tv", "TV A", "sonarr-a", 8989, "cccccccccccccccccccccccccccccccc"],
    ["tv", "TV B", "sonarr-b", 8989, "dddddddddddddddddddddddddddddddd"],
  ];
  const instances = [];
  for (const [domain, name, host, port, apiCredential] of specifications) {
    const created = await json(`${app}/api/settings/engines/instances`, { method: "POST", headers: mutationHeaders, body: JSON.stringify({ domain, name, host, port, apiCredential }) });
    instances.push(created.value.instance);
  }
  const expected = new Map([["Movies A", "Fight Club"], ["Movies B", "Pulp Fiction"], ["TV A", "Lost"], ["TV B", "Breaking Bad"]]);
  for (const instance of instances) {
    const result = (await json(`${app}/api/manage/${instance.domain}/library?engineInstanceId=${encodeURIComponent(instance.id)}`, { headers: readHeaders })).value.result;
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 1, "the lab intentionally gives every engine native ID 1");
    assert.equal(result[0].title, expected.get(instance.name));
    assert.equal(result[0].engineInstanceId, instance.id);
    assert.equal(result[0].engineInstanceName, instance.name);
  }
  const [movieA, movieB] = instances.filter((item) => item.domain === "movie");
  for (const instance of [movieA, movieB]) {
    const suffix = `engineInstanceId=${encodeURIComponent(instance.id)}`;
    const [profiles, roots, tags] = await Promise.all([
      json(`${app}/api/manage/movie/profiles?${suffix}`, { headers: readHeaders }),
      json(`${app}/api/manage/movie/rootFolders?${suffix}`, { headers: readHeaders }),
      json(`${app}/api/manage/movie/tags?${suffix}`, { headers: readHeaders }),
    ]);
    for (const result of [profiles.value.result, roots.value.result, tags.value.result]) {
      assert.ok(result.length > 0);
      assert.ok(result.every((item) => item.engineInstanceId === instance.id));
      assert.ok(result.every((item) => item.engineInstanceName === instance.name));
    }
  }
  const movieAProfile = (await json(`${app}/api/manage/movie/profiles?engineInstanceId=${movieA.id}`, { headers: readHeaders })).value.result[0];
  const movieBProfile = (await json(`${app}/api/manage/movie/profiles?engineInstanceId=${movieB.id}`, { headers: readHeaders })).value.result[0];
  assert.equal(movieAProfile.id, movieBProfile.id, "duplicate profile IDs must remain isolated by instance ownership");
  const movieATag = (await json(`${app}/api/manage/movie/tags?engineInstanceId=${movieA.id}`, { headers: readHeaders })).value.result[0];
  const movieBTag = (await json(`${app}/api/manage/movie/tags?engineInstanceId=${movieB.id}`, { headers: readHeaders })).value.result[0];
  assert.equal(movieATag.id, movieBTag.id, "duplicate tag IDs must remain isolated by instance ownership");
  const inventory = (await json(`${app}/api/settings/engines/instances/${movieA.id}/inventory`, { headers: readHeaders })).value;
  assert.equal(inventory.instance.name, "Movies A");
  assert.ok(inventory.summary.identified >= 10);
  assert.equal(inventory.storage[0].enginePath, "/movies-a");
  const unavailableMapping = (await json(`${app}/api/settings/engines/instances/${movieA.id}/storage`, { method: "PUT", headers: mutationHeaders, body: JSON.stringify({ enginePath: "/movies-a", vynodePath: "/media/not-mounted", hostPath: "/mnt/user/movies-a" }) })).value;
  assert.equal(unavailableMapping.restartRequired, true);
  assert.match(unavailableMapping.mapping.remediation.unraid, /restart VynodeArr/i);
  const verifiedMapping = (await json(`${app}/api/settings/engines/instances/${movieA.id}/storage`, { method: "PUT", headers: mutationHeaders, body: JSON.stringify({ enginePath: "/movies-a", vynodePath: "/movies-a", hostPath: "/mnt/user/movies-a" }) })).value;
  assert.equal(verifiedMapping.restartRequired, false);
  assert.equal(verifiedMapping.mapping.accessible, true);
  const owned = (await json(`${app}/api/manage/movie/library?engineInstanceId=${movieA.id}`, { headers: readHeaders })).value.result[0];
  const conflict = await fetch(`${app}/api/manage/movie/library/movie_${movieA.id}_1?engineInstanceId=${movieB.id}`, { headers: readHeaders });
  assert.equal(conflict.status, 400, "owned IDs cannot be routed to another instance");
  await json(`${app}/api/manage/movie/library/1?engineInstanceId=${movieA.id}`, { method: "PUT", headers: mutationHeaders, body: JSON.stringify({ ...owned, monitored: true }) });
  const a = (await json("http://127.0.0.1:17878/api/v3/movie/1", { headers: engineHeaders("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") })).value;
  const b = (await json("http://127.0.0.1:27878/api/v3/movie/1", { headers: engineHeaders("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb") })).value;
  assert.equal(a.monitored, true);
  assert.equal(b.monitored, false, "mutation of Movies A must not cross into Movies B");
  console.log("Multi-engine Docker integration passed: four real engines, configuration inventory, storage remediation and verification, duplicate library/profile/root/tag IDs, authoritative ownership, conflict rejection, and isolated mutation.");
} finally {
  if (process.env.VYNODEARR_KEEP_MULTI_ENGINE_LAB === "true")
    console.log("Multi-engine Docker lab retained at http://127.0.0.1:18686 for visual testing.");
  else run("down", "--volumes", "--remove-orphans");
}
