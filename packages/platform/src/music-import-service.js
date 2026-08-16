import {
  access,
  copyFile,
  mkdir,
  readdir,
  realpath,
  stat,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

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
  constructor({ store }) {
    this.store = store;
  }
  async settings(input = null) {
    if (input) {
      const downloadPath = resolve(clean(input.downloadPath)),
        libraryRoot = resolve(clean(input.libraryRoot));
      if (!clean(input.downloadPath) || !clean(input.libraryRoot))
        throw new TypeError("Music download and library paths are required");
      await this.store.update((state) => {
        state.settings = {
          ...(state.settings || {}),
          downloadPath,
          libraryRoot,
          naming: clean(input.naming) || "{track:02} - {title}",
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
      );
    if (!album || !artist || !tracks.length)
      throw new Error("Load album edition metadata before importing files");
    const available = await files(source),
      unmatched = new Set(available),
      matches = [];
    for (const track of tracks.sort(
      (a, b) =>
        a.mediumNumber - b.mediumNumber || a.trackNumber - b.trackNumber,
    )) {
      const padded = String(track.trackNumber).padStart(2, "0"),
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
        path = byNumber || byTitle || null;
      if (path) unmatched.delete(path);
      const confidence =
        byNumber && byTitle ? 100 : byNumber ? 85 : byTitle ? 70 : 0;
      matches.push({
        trackId: track.id,
        title: track.title,
        mediumNumber: track.mediumNumber,
        trackNumber: track.trackNumber,
        sourcePath: path,
        confidence,
        reason:
          byNumber && byTitle
            ? "Track number and title match"
            : byNumber
              ? "Track number match"
              : byTitle
                ? "Title match"
                : "No matching audio file",
      });
    }
    return {
      album: { id: album.id, title: album.title, artist: artist.name },
      sourcePath: source,
      matches,
      unmatchedFiles: [...unmatched],
      ready: matches.every(
        (value) => value.sourcePath && value.confidence >= 70,
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
    for (const file of plan) {
      await copyFile(file.sourcePath, file.filePath, fsConstants.COPYFILE_EXCL);
      imported.push(file);
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
}
