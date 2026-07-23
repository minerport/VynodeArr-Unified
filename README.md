# VynodeNew

VynodeNew is one secure Movies and TV review application. The browser talks
only to the VynodeNew gateway; separately running media engines remain hidden
and authoritative. N2 is strictly read-only.

## Fastest local review

1. Copy `.env.example` to `.env` (it defaults to deterministic fixture mode).
2. Run `docker compose up --build -d`.
3. Open `http://127.0.0.1:4310`.
4. Create the initial administrator in the setup screen.

To review real data, set `VYNODENEW_DATA_MODE=engine`, configure the neutral
`MOVIE_ENGINE_*` and `TV_ENGINE_*` variables, and restart. Prefer mounted
credential files over environment values. See
`docs/LOCAL_REVIEW_DEPLOYMENT.md` and `docs/ENGINE_CONFIGURATION.md`.

Without Docker, use Node.js 20 or newer: `npm start`. Run all release gates with
`npm run verify`. No production credentials or engine binaries are included.
