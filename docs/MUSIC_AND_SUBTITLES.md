# Music and subtitle architecture

VynodeArr implements music and subtitle management as native capabilities. No
Lidarr or Bazarr source code, DTOs, branding, routes, or database structures are
embedded.

## Music

Music uses artist → album → track identities. Monitoring belongs to VynodeArr
and supports all, future, missing, or none. Release searches return a numeric
score and human-readable reasons so an automatic choice can always be audited.

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

## API surfaces

- `GET /api/music` and `GET /api/subtitles` return secret-free workspaces.
- Music provider configuration lives under `/api/music/indexers` and
  `/api/music/download-clients`.
- Music operations use `/api/music/search` and `/api/music/grab`.
- Subtitle configuration uses `/api/subtitles/providers`, `/profiles`, and
  `/assignments`.
- Per-file inventory and automation use `/api/subtitles/reconcile`, `/search`,
  `/download`, and `/media-arrived`.

All mutations require an administrator session and a valid CSRF token. Existing
movie and television engine contracts are unchanged.
