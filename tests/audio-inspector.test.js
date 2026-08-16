import test from "node:test";
import assert from "node:assert/strict";
import {
  audioQuality,
  inspectAudioFile,
} from "../.server-build/packages/platform/src/audio-inspector.js";

test("audio inspection maps technical properties and durable embedded identities", async () => {
  const value = await inspectAudioFile("/music/track.flac", {
    runner: async () => ({
      stdout: JSON.stringify({
        format: {
          duration: "181.25",
          bit_rate: "921600",
          tags: {
            TITLE: "Song",
            ARTIST: "Artist",
            TRACK: "2/10",
            DISCNUMBER: "1",
            MUSICBRAINZ_TRACKID: "track-id",
            MUSICBRAINZ_RECORDINGID: "recording-id",
            MUSICBRAINZ_ALBUMID: "release-id",
            ISRC: "USABC123",
          },
        },
        streams: [
          {
            codec_type: "audio",
            codec_name: "flac",
            sample_rate: "48000",
            channels: 2,
            bits_per_raw_sample: "24",
          },
        ],
      }),
    }),
  });
  assert.equal(value.durationMs, 181250);
  assert.equal(value.trackNumber, 2);
  assert.equal(value.musicBrainzRecordingId, "recording-id");
  assert.equal(audioQuality(value).lossless, true);
  assert.match(audioQuality(value).label, /24-bit/);
});
