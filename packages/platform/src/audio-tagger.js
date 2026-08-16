import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { extname } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const value = (input) => String(input ?? "").trim();

export async function writeAudioTags(
  path,
  tags,
  {
    binary = process.env.VYNODEARR_FFMPEG_BINARY || "ffmpeg",
    runner = run,
    move = rename,
    remover = rm,
  } = {},
) {
  const extension = extname(path),
    temporary = `${path}.vynode-tagging-${randomUUID()}${extension}`,
    backup = `${path}.vynode-original-${randomUUID()}${extension}`,
    metadata = {
      title: tags.title,
      artist: tags.artist,
      album_artist: tags.albumArtist || tags.artist,
      album: tags.album,
      track: tags.trackNumber,
      disc: tags.discNumber,
      MUSICBRAINZ_TRACKID: tags.musicBrainzTrackId,
      MUSICBRAINZ_RECORDINGID: tags.musicBrainzRecordingId,
      MUSICBRAINZ_ALBUMID: tags.musicBrainzReleaseId,
      ISRC: tags.isrc,
    },
    args = ["-v", "error", "-nostdin", "-i", path, "-map", "0", "-codec", "copy", "-map_metadata", "0"];
  for (const [name, entry] of Object.entries(metadata))
    if (value(entry)) args.push("-metadata", `${name}=${value(entry)}`);
  args.push("-y", temporary);
  try {
    await runner(binary, args, {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
    });
    await move(path, backup);
    try {
      await move(temporary, path);
    } catch (error) {
      await move(backup, path);
      throw error;
    }
    await remover(backup, { force: true });
  } catch (error) {
    await remover(temporary, { force: true }).catch(() => {});
    throw new Error(`Audio tag writing failed for ${path}: ${error?.message || error}`);
  }
  return { path, tags: metadata };
}
