# Music and subtitle architecture

VynodeArr implements music and subtitle management as native capabilities. No
Lidarr or Bazarr source code, DTOs, branding, routes, or database structures are
embedded.

## Music

Music uses artist → album → track identities. Monitoring belongs to VynodeArr
and supports all, future, missing, or none. Release searches return a numeric
score and human-readable reasons so an automatic choice can always be audited.

Artist discovery uses MusicBrainz as the authoritative identity source. It is
enabled automatically, requires no API key, sends the required VynodeArr user
agent, and is globally limited to one request per second. Imported artists keep
their MusicBrainz artist ID; conceptual albums keep release-group IDs and full
artist credits. Cover Art Archive release-group artwork is retained separately.
Administrators may add Last.fm as an optional enrichment provider using their
own API key for biographies, tags, and popularity data. That key uses the same
encrypted credential vault as indexer and download-client secrets.

Release groups can load and rank their official editions. The selected edition
retains country, date, format, barcode, labels, media/discs, track positions,
recording IDs, durations, artist credits, and ISRCs. Completed downloads use a
review-first importer: the source must resolve below the configured download
root, every track needs a confident number or title match, destinations remain
below the music library root, existing files are never overwritten, and source
downloads are retained. Provider rows expose connection testing and removal.

The importer inspects audio with `ffprobe` (or the binary selected by
`VYNODEARR_FFPROBE_BINARY`). Embedded MusicBrainz IDs and ISRCs are preferred
over disc/track positions, duration, and filename matching. Inspection retains
codec, bitrate, sample rate, bit depth, channels, duration, and lossless status
for review and quality decisions. Quality profiles can allow lossy or lossless
audio, enforce minimum bitrate/sample rate/bit depth, and rank preferred codecs.
An assigned artist profile is enforced during import analysis, with each rejected
file retaining the exact technical reason. Multi-file imports are transactional:
if a copy fails, files created by that attempt are removed before library state
is updated.

Successful copies are tagged through `ffmpeg` stream-copy rewriting with title,
artist, album, disc/track positions, MusicBrainz identities, and ISRC. Replacement
is atomic and preserves the original if rewriting fails. The binary can be set
with `VYNODEARR_FFMPEG_BINARY`. Library scans inspect existing audio, reconcile
durable embedded identities, update detected quality, and mark disappeared files
missing so monitoring can recover them.

Users may add an AcoustID metadata provider with their own API key. When imported
audio has no MusicBrainz or ISRC tags, VynodeArr can run `fpcalc` (configurable
with `VYNODEARR_FPCALC_BINARY`) and accept only high-confidence AcoustID results
that resolve to the expected MusicBrainz recording.

Music providers are deliberately split:

- **Indexers** discover Usenet or torrent releases. Supported connector shapes
  are Newznab, Torznab, and a VynodeArr custom HTTP adapter.
- **Download clients** receive a selected release. Connector shapes include
  SABnzbd, NZBGet, qBittorrent, and a custom HTTP adapter.

The initial production connectors cover the common Lidarr deployment shapes:
Newznab, Torznab/Prowlarr, SABnzbd, NZBGet, and qBittorrent. Music downloads use
a dedicated category (normally `music`) so unrelated client jobs never enter
VynodeArr activity. Results retain protocol, size, age, seeders, score, and the
human-readable reasons behind that score.

VynodeArr can poll SABnzbd, NZBGet, and qBittorrent for completed jobs in the
dedicated music category. A job associated with an album and an output path is
handed to the guarded importer automatically; the same root-boundary, matching,
retention, and no-overwrite rules still apply.

Background media automation polls download clients, searches a bounded batch of
monitored albums with missing tracks, and retries due subtitle jobs. Album search
uses a configurable score floor and cooldown to prevent duplicate grabs.
Albums with complete file counts also become candidates when scanned track
quality violates their assigned profile or preferred codec target.
Unsuccessful subtitle searches use persisted exponential backoff. Set
`VYNODEARR_MEDIA_AUTOMATION_ENABLED=false` to disable the worker; its interval,
batch sizes, music score floor, and cooldown are configurable with the
`VYNODEARR_MEDIA_AUTOMATION_*`, `VYNODEARR_MUSIC_AUTOMATION_*`, and
`VYNODEARR_SUBTITLE_AUTOMATION_*` environment variables.

Remote music and subtitle operations are protected by provider circuit breakers.
Three consecutive failures pause the affected connector for five minutes, and
secret-free health snapshots expose failure count, last error, last success, and
the current cooldown state.

Administrators can persist automation enablement, music batch and score limits,
duplicate cooldown, and subtitle retry batch size from the Music workspace. The
same workspace retains a bounded operational ledger for searches, grabs, scans,
imports, skips, and failures.

Encrypted application backups include music state, subtitle state, automation
history, and the separate encrypted media-provider credential vault. Restore
validation allowlists these files and reports their presence in the backup
summary.

Each configured provider has an endpoint, credentials, priority, enabled state,
capabilities, and connection test. Credentials are encrypted in the dedicated
AES-256-GCM media-provider vault and removed from public API responses and JSON
configuration. Existing plaintext provider records migrate on first read.

## Subtitles

Subtitle providers search and download subtitle files directly; they are not
indexers and do not use music/movie download clients. A provider advertises its
languages and capabilities and may represent a hosted source, a custom HTTP
adapter, or local speech recognition.

The initial production providers are OpenSubtitles.com and a Whisper ASR HTTP
service. OpenSubtitles uses its JSON login, search, and download flow. Whisper
receives the local media file and writes generated SRT output beside the movie
or individual episode. Both paths share the same coverage and history model.
Existing SRT, ASS, SSA, VTT, and SUB sidecars are detected beside each movie or
episode during reconciliation. Deferred searches remain visible and can be
retried in one administrator action.

Language profiles specify normal languages, forced languages, hearing-impaired
preference, and an optional upgrade score. Assignments inherit in this order:

1. episode
2. season
3. series
4. movie

Every imported movie or episode is reconciled as an individual item. A media
arrival calculates missing languages and creates one awaiting-search job for
each gap. Successful downloads update coverage and append immutable provider,
language, path, and timestamp history.

Managed subtitle history also retains score, release, forced, and
hearing-impaired attributes. Profiles can continue searching until their score
target and preference rules are met, and only strictly better candidates replace
a managed subtitle. ZIP responses are inspected in memory with traversal-safe
entry selection and support stored or deflated subtitle files.

## API surfaces

- `GET /api/music` and `GET /api/subtitles` return secret-free workspaces.
- Music provider configuration lives under `/api/music/indexers` and
  `/api/music/download-clients`.
- Music operations use `/api/music/search` and `/api/music/grab`.
- Music quality and completion automation use
  `/api/music/quality-profiles` and `/api/music/downloads/poll`.
- A manual monitored-missing pass uses `/api/music/missing/search`.
- Existing-file reconciliation uses `/api/music/library/scan`.
- Subtitle configuration uses `/api/subtitles/providers`, `/profiles`, and
  `/assignments`.
- Per-file inventory and automation use `/api/subtitles/reconcile`, `/search`,
  `/download`, and `/media-arrived`.

All mutations require an administrator session and a valid CSRF token. Existing
movie and television engine contracts are unchanged.
