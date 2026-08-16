import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const number = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : null;
const tag = (tags, ...names) => {
  for (const name of names) {
    const value =
      tags?.[name] ?? tags?.[name.toLowerCase()] ?? tags?.[name.toUpperCase()];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return null;
};
const position = (value) => {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
};

export async function inspectAudioFile(
  path,
  {
    binary = process.env.VYNODEARR_FFPROBE_BINARY || "ffprobe",
    runner = run,
  } = {},
) {
  const { stdout } = await runner(
      binary,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration,bit_rate:format_tags:stream=codec_name,codec_type,sample_rate,channels,bits_per_raw_sample,bits_per_sample",
        "-of",
        "json",
        path,
      ],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: 30_000 },
    ),
    value = JSON.parse(stdout),
    stream =
      (value.streams || []).find((entry) => entry.codec_type === "audio") || {},
    tags = value.format?.tags || {};
  return {
    path,
    codec: stream.codec_name || null,
    bitrate: number(value.format?.bit_rate),
    sampleRate: number(stream.sample_rate),
    channels: number(stream.channels),
    bitDepth: number(stream.bits_per_raw_sample || stream.bits_per_sample),
    durationMs:
      number(value.format?.duration) != null
        ? Math.round(Number(value.format.duration) * 1000)
        : null,
    title: tag(tags, "title"),
    artist: tag(tags, "artist"),
    albumArtist: tag(tags, "album_artist", "albumartist"),
    album: tag(tags, "album"),
    trackNumber: position(tag(tags, "track")),
    discNumber: position(tag(tags, "disc", "discnumber")),
    musicBrainzTrackId: tag(tags, "musicbrainz_trackid", "MUSICBRAINZ_TRACKID"),
    musicBrainzRecordingId: tag(
      tags,
      "musicbrainz_recordingid",
      "MUSICBRAINZ_RECORDINGID",
    ),
    musicBrainzReleaseId: tag(
      tags,
      "musicbrainz_albumid",
      "MUSICBRAINZ_ALBUMID",
    ),
    isrc: tag(tags, "isrc"),
  };
}

export function audioQuality(metadata) {
  const codec = String(metadata.codec || "").toLowerCase(),
    lossless = [
      "flac",
      "alac",
      "wavpack",
      "ape",
      "pcm_s16le",
      "pcm_s24le",
      "pcm_s32le",
    ].some((value) => codec.includes(value));
  return {
    lossless,
    codec: metadata.codec || null,
    bitrate: metadata.bitrate || null,
    sampleRate: metadata.sampleRate || null,
    bitDepth: metadata.bitDepth || null,
    channels: metadata.channels || null,
    label: lossless
      ? `${metadata.bitDepth || "?"}-bit ${metadata.sampleRate ? `${Math.round(metadata.sampleRate / 100) / 10} kHz ` : ""}${String(metadata.codec || "Lossless").toUpperCase()}`
      : `${metadata.bitrate ? `${Math.round(metadata.bitrate / 1000)} kbps ` : ""}${String(metadata.codec || "Unknown").toUpperCase()}`,
  };
}
