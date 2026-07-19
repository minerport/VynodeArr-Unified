# Source inventory

## Movie source

- Repository: `https://github.com/minerport/VydodeArr`
- Branch: `main`
- Revision: `de4811318ef1eb6560a5e480cc4bba2afc008ca9`
- Origin baseline: Radarr `develop`
- Default HTTP/HTTPS ports: 7878/8787
- SQLite database: `radarr.db`
- API generation: V3
- Domain roots: Movies, MovieFiles, Collections, Credits, MovieStats

## Television source

- Repository: `https://github.com/minerport/VynodeArr2`
- Branch: `main`
- Revision: `a29f15e92bd2c21e646d065d9d78066952cac05d`
- Origin baseline: Sonarr `v5-develop`
- Default HTTP/HTTPS ports: 8989/9898
- SQLite database: `sonarr.db`
- API generations: V3 and V5
- Domain roots: Series/Tv, Episodes, EpisodeFiles, SeriesStats, Statistics, DataAugmentation

## Repository ownership rule

Both repositories are standalone GitHub repositories under `minerport`, not GitHub forks. The unified workspace must reference only those user-owned repositories. No upstream remote is configured by the unified project, and no automated contribution or pull-request path to upstream is provided.
