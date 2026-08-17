import {
  access,
  copyFile,
  mkdir,
  readdir,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { audioQuality, inspectAudioFile } from "./audio-inspector.js";
import { writeAudioTags } from "./audio-tagger.js";

const audioExtensions = new Set([
  ".flac",
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
  ".wav",
  ".alac",
]);
const clean = (value) => String(value ?? "").trim();
const safeName = (value) =>
  clean(value)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[. ]+$/, "")
    .slice(0, 180) || "Unknown";
const inside = (root, target) => {
  const value = relative(resolve(root), resolve(target));
  return (
    value === "" ||
    (!value.startsWith("..") &&
      !value.startsWith("/") &&
      !value.startsWith("\\"))
  );
};
const normalize = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const qualityCompliance = (metadata, profile) => {
  if (!profile) return { accepted: true, reasons: [] };
  if (!metadata)
    return { accepted: false, reasons: ["Audio properties could not be inspected"] };
  const quality = audioQuality(metadata),
    reasons = [];
  if (quality.lossless && profile.allowLossless === false)
    reasons.push("Lossless audio is not allowed by the assigned quality profile");
  if (!quality.lossless && profile.allowLossy === false)
    reasons.push("Lossy audio is not allowed by the assigned quality profile");
  const bitrateKbps = Math.round(Number(metadata.bitrate || 0) / 1000);
  if (profile.minBitrateKbps && bitrateKbps < profile.minBitrateKbps)
    reasons.push(`Bitrate ${bitrateKbps} kbps is below ${profile.minBitrateKbps} kbps`);
  if (profile.minSampleRate && Number(metadata.sampleRate || 0) < profile.minSampleRate)
    reasons.push(`Sample rate ${Number(metadata.sampleRate || 0)} Hz is below ${profile.minSampleRate} Hz`);
  if (profile.minBitDepth && Number(metadata.bitDepth || 0) < profile.minBitDepth)
    reasons.push(`Bit depth ${Number(metadata.bitDepth || 0)} is below ${profile.minBitDepth}`);
  return { accepted: reasons.length === 0, reasons };
};
async function files(path) {
  const output = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) output.push(...(await files(target)));
    else if (
      entry.isFile() &&
      audioExtensions.has(extname(entry.name).toLowerCase())
    )
      output.push(target);
  }
  return output;
}

export class MusicImportService {
  constructor({ store, inspector = inspectAudioFile, fingerprintMatcher = null, tagger = writeAudioTags, copier = copyFile, remover = rm }) {
    this.store = store;
    this.inspector = inspector;
    this.fingerprintMatcher = fingerprintMatcher;
    this.tagger = tagger;
    this.copier = copier;
    this.remover = remover;
  }
  async settings(input = null) {
    if (input) {
      const existing = (await this.store.read()).settings || {},
        rawDownloadPath = clean(input.downloadPath ?? existing.downloadPath),
        rawLibraryRoot = clean(input.libraryRoot ?? existing.libraryRoot),
        downloadPath = rawDownloadPath ? resolve(rawDownloadPath) : "",
        libraryRoot = rawLibraryRoot ? resolve(rawLibraryRoot) : "";
      await this.store.update((state) => {
        state.settings = {
          ...(state.settings || {}),
          downloadPath,
          libraryRoot,
          naming: clean(input.naming ?? existing.naming) || "{track:02} - {title}",
          updatedAt: new Date().toISOString(),
        };
      });
    }
    return (
      (await this.store.read()).settings || {
        downloadPath: "",
        libraryRoot: "",
        naming: "{track:02} - {title}",
      }
    );
  }
  async analyze({ albumId, sourcePath }) {
    const state = await this.store.read(),
      settings = state.settings || {},
      source = await realpath(resolve(clean(sourcePath)));
    if (!settings.downloadPath || !settings.libraryRoot)
      throw new Error(
        "Configure music download and library folders before importing",
      );
    const downloadRoot = await realpath(settings.downloadPath);
    if (!inside(downloadRoot, source))
      throw new Error(
        "The import source must be inside the configured music download folder",
      );
    if (!(await stat(source)).isDirectory())
      throw new Error("The import source must be a directory");
    const album = (state.albums || []).find((value) => value.id === albumId),
      artist = (state.artists || []).find(
        (value) => value.id === album?.artistId,
      ),
      tracks = (state.tracks || []).filter(
        (value) => value.albumId === albumId,
      ),
      qualityProfile = (state.qualityProfiles || []).find(
        (value) => value.id === artist?.qualityProfile || value.name === artist?.qualityProfile,
      ) || null;
    if (!album || !artist || !tracks.length)
      throw new Error("Load album edition metadata before importing files");
    const available = await files(source),
      inspected = new Map(
        await Promise.all(
          available.map(async (path) => {
            try {
              const metadata = await this.inspector(path);
              if (
                this.fingerprintMatcher &&
                !metadata.musicBrainzTrackId &&
                !metadata.musicBrainzRecordingId &&
                !metadata.isrc
              ) {
                const matches = await this.fingerprintMatcher(path).catch(() => []);
                metadata.fingerprintMatches = matches;
              }
              return [path, metadata];
            } catch {
              return [path, null];
            }
          }),
        ),
      ),
      unmatched = new Set(available),
      matches = [];
    for (const track of tracks.sort(
      (a, b) =>
        a.mediumNumber - b.mediumNumber || a.trackNumber - b.trackNumber,
    )) {
      const exactIdentity = [...unmatched].find((path) => {
          const metadata = inspected.get(path);
          return (
            (track.foreignTrackId && metadata?.musicBrainzTrackId === track.foreignTrackId) ||
            (track.foreignRecordingId && metadata?.musicBrainzRecordingId === track.foreignRecordingId) ||
            (track.foreignRecordingId && metadata?.fingerprintMatches?.some(
              (value) => value.recordingId === track.foreignRecordingId,
            )) ||
            (metadata?.isrc && track.isrcs?.includes(metadata.isrc))
          );
        }),
        taggedPosition = [...unmatched].find((path) => {
          const metadata = inspected.get(path);
          return (
            metadata?.trackNumber === track.trackNumber &&
            (metadata.discNumber || 1) === (track.mediumNumber || 1)
          );
        }),
        padded = String(track.trackNumber).padStart(2, "0"),
        byNumber = [...unmatched].find((path) =>
          new RegExp(`(?:^|[^0-9])${padded}(?:[^0-9]|$)`).test(
            basename(path, extname(path)),
          ),
        ),
        byTitle = [...unmatched].find((path) =>
          normalize(basename(path, extname(path))).includes(
            normalize(track.title),
          ),
        ),
        path = exactIdentity || taggedPosition || byNumber || byTitle || null;
      if (path) unmatched.delete(path);
      const metadata = path ? inspected.get(path) : null,
        compliance = qualityCompliance(metadata, qualityProfile),
        fingerprintIdentity = Boolean(
          exactIdentity &&
          track.foreignRecordingId &&
          metadata?.fingerprintMatches?.some(
            (value) => value.recordingId === track.foreignRecordingId,
          ) &&
          metadata?.musicBrainzRecordingId !== track.foreignRecordingId,
        ),
        durationClose =
          metadata?.durationMs && track.durationMs
            ? Math.abs(metadata.durationMs - track.durationMs) <= 3000
            : false,
        confidence = exactIdentity
          ? fingerprintIdentity ? 99 : 100
          : taggedPosition && durationClose
            ? 98
            : taggedPosition
              ? 92
              : byNumber && byTitle
                ? 90
                : byNumber
                  ? 80
                  : byTitle
                    ? 70
                    : 0;
      matches.push({
        trackId: track.id,
        title: track.title,
        mediumNumber: track.mediumNumber,
        trackNumber: track.trackNumber,
        musicBrainzTrackId: track.foreignTrackId || null,
        musicBrainzRecordingId: track.foreignRecordingId || null,
        musicBrainzReleaseId: album.foreignReleaseId || album.selectedEditionId?.replace(/^edition_/, "") || null,
        isrc: track.isrcs?.[0] || null,
        sourcePath: path,
        metadata,
        quality: metadata ? audioQuality(metadata) : null,
        qualityAccepted: compliance.accepted,
        qualityReasons: compliance.reasons,
        confidence,
        reason: exactIdentity
          ? fingerprintIdentity
            ? "AcoustID Chromaprint recording match"
            : "Embedded MusicBrainz or ISRC identity match"
          : taggedPosition && durationClose
            ? "Embedded disc, track, and duration match"
            : taggedPosition
              ? "Embedded disc and track match"
              : byNumber && byTitle
                ? "Filename track number and title match"
                : byNumber
                  ? "Filename track number match"
                  : byTitle
                    ? "Filename title match"
                    : "No matching audio file",
      });
    }
    return {
      album: { id: album.id, title: album.title, artist: artist.name },
      qualityProfile: qualityProfile
        ? { id: qualityProfile.id, name: qualityProfile.name }
        : null,
      sourcePath: source,
      matches,
      unmatchedFiles: [...unmatched],
      ready: matches.every(
        (value) =>
          value.sourcePath && value.confidence >= 70 && value.qualityAccepted,
      ),
    };
  }
  async execute(input) {
    const review = await this.analyze(input);
    if (!review.ready)
      throw new Error(
        "Resolve unmatched or low-confidence files before importing",
      );
    const state = await this.store.read(),
      settings = state.settings,
      destination = resolve(
        settings.libraryRoot,
        safeName(review.album.artist),
        safeName(review.album.title),
      );
    if (!inside(settings.libraryRoot, destination))
      throw new Error("The destination escapes the configured music library");
    await mkdir(destination, { recursive: true });
    const plan = review.matches.map((match) => {
      const extension = extname(match.sourcePath).toLowerCase(),
        name = `${String(match.trackNumber).padStart(2, "0")} - ${safeName(match.title)}${extension}`,
        target = join(destination, name);
      return { ...match, filePath: target };
    });
    for (const file of plan) {
      try {
        await access(file.filePath);
        throw new Error(
          `The destination file already exists: ${file.filePath}`,
        );
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    const imported = [];
    try {
      for (const file of plan) {
        await this.copier(file.sourcePath, file.filePath, fsConstants.COPYFILE_EXCL);
        imported.push(file);
        if (
          file.metadata?.codec &&
          file.metadata?.sampleRate &&
          file.metadata?.durationMs &&
          this.tagger
        )
          await this.tagger(file.filePath, {
            title: file.title,
            artist: review.album.artist,
            albumArtist: review.album.artist,
            album: review.album.title,
            trackNumber: file.trackNumber,
            discNumber: file.mediumNumber,
            musicBrainzTrackId: file.musicBrainzTrackId,
            musicBrainzRecordingId: file.musicBrainzRecordingId,
            musicBrainzReleaseId: file.musicBrainzReleaseId,
            isrc: file.isrc,
          });
      }
    } catch (error) {
      await Promise.allSettled(
        imported.map((file) => this.remover(file.filePath, { force: true })),
      );
      throw error;
    }
    await this.store.update((value) => {
      for (const file of imported) {
        const track = (value.tracks || []).find(
          (entry) => entry.id === file.trackId,
        );
        if (track) {
          track.hasFile = true;
          track.filePath = file.filePath;
          track.importedAt = new Date().toISOString();
        }
      }
      const album = (value.albums || []).find(
        (entry) => entry.id === input.albumId,
      );
      if (album)
        album.availableTrackCount = (value.tracks || []).filter(
          (entry) => entry.albumId === album.id && entry.hasFile,
        ).length;
      value.jobs ||= [];
      value.jobs.unshift({
        id: `music_import_${Date.now()}`,
        kind: "import",
        title: `${review.album.artist} - ${review.album.title}`,
        status: "completed",
        fileCount: imported.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    return { destination, imported };
  }
  async scanLibrary() {
    const state = await this.store.read(),
      settings = state.settings || {};
    if (!settings.libraryRoot)
      throw new Error("Configure the music library folder before scanning");
    const root = await realpath(settings.libraryRoot),
      discovered = await files(root),
      inspected = [];
    for (const path of discovered) {
      try {
        inspected.push({ path, metadata: await this.inspector(path) });
      } catch (error) {
        inspected.push({ path, metadata: null, error: clean(error?.message || error) });
      }
    }
    let matched = 0;
    await this.store.update((value) => {
      for (const track of value.tracks || []) {
        const found = inspected.find((file) =>
          file.path === track.filePath ||
          (track.foreignTrackId && file.metadata?.musicBrainzTrackId === track.foreignTrackId) ||
          (track.foreignRecordingId && file.metadata?.musicBrainzRecordingId === track.foreignRecordingId) ||
          (file.metadata?.isrc && track.isrcs?.includes(file.metadata.isrc)),
        );
        track.hasFile = Boolean(found);
        track.filePath = found?.path || null;
        if (found) {
          track.quality = audioQuality(found.metadata);
          track.scannedAt = new Date().toISOString();
          matched += 1;
        }
      }
      for (const album of value.albums || [])
        album.availableTrackCount = (value.tracks || []).filter(
          (track) => track.albumId === album.id && track.hasFile,
        ).length;
      value.jobs ||= [];
      value.jobs.unshift({
        id: `music_scan_${Date.now()}`,
        kind: "library-scan",
        title: "Music library scan",
        status: "completed",
        fileCount: discovered.length,
        matchedCount: matched,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    return {
      scanned: discovered.length,
      matched,
      unmatched: inspected.filter((file) =>
        !(state.tracks || []).some((track) =>
          file.path === track.filePath ||
          (track.foreignTrackId && file.metadata?.musicBrainzTrackId === track.foreignTrackId) ||
          (track.foreignRecordingId && file.metadata?.musicBrainzRecordingId === track.foreignRecordingId) ||
          (file.metadata?.isrc && track.isrcs?.includes(file.metadata.isrc)),
        ),
      ).map((file) => ({ path: file.path, error: file.error || null })),
    };
  }
}
