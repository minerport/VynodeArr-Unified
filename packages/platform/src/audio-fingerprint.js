import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const endpoint = (value) => String(value || "https://api.acoustid.org/v2").replace(/\/+$/, "");

export async function fingerprintAudio(
  path,
  { binary = process.env.VYNODEARR_FPCALC_BINARY || "fpcalc", runner = run } = {},
) {
  const { stdout } = await runner(binary, ["-json", path], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000,
    }),
    value = JSON.parse(stdout);
  if (!value.fingerprint || !Number(value.duration))
    throw new Error("Chromaprint did not return a usable audio fingerprint");
  return { fingerprint: String(value.fingerprint), duration: Math.round(Number(value.duration)) };
}

export async function lookupAcoustId(
  path,
  provider,
  { fetcher = globalThis.fetch, fingerprinter = fingerprintAudio } = {},
) {
  if (!provider?.apiKey) throw new Error("An AcoustID API key is required");
  const fingerprint = await fingerprinter(path),
    url = new URL(`${endpoint(provider.endpoint)}/lookup`);
  url.searchParams.set("client", provider.apiKey);
  url.searchParams.set("duration", String(fingerprint.duration));
  url.searchParams.set("fingerprint", fingerprint.fingerprint);
  url.searchParams.set("meta", "recordings+releasegroups");
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`AcoustID returned HTTP ${response.status}`);
  const value = await response.json();
  if (value.status !== "ok") throw new Error(value.error?.message || "AcoustID lookup failed");
  return (value.results || [])
    .filter((result) => Number(result.score || 0) >= 0.8)
    .flatMap((result) =>
      (result.recordings || []).map((recording) => ({
        acoustId: result.id,
        score: Number(result.score || 0),
        recordingId: recording.id,
        title: recording.title || null,
        releaseGroupIds: (recording.releasegroups || []).map((group) => group.id),
      })),
    )
    .sort((a, b) => b.score - a.score);
}
