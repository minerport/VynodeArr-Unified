# Contributing to VynodeArr

## Core safety rule

Movies and television share a product shell, not application state. Keep their processes, databases, configuration, API credentials, queues, commands, events, logs, and upgrade lifecycles isolated.

Do not:

- combine movie and television databases or migrations;
- send an unscoped command to either native engine;
- reuse an engine API key across domains;
- kill unrelated Radarr or Sonarr processes installed elsewhere;
- commit native engine builds, installers, generated output, credentials, databases, or user data;
- change a locked native engine revision without updating `distribution/source-lock.json` and the source inventory.

## Local checks

Before committing gateway or packaging changes, run:

```powershell
dotnet restore VynodeArr.Unified.sln
dotnet build VynodeArr.Unified.sln --configuration Release --no-restore
dotnet test VynodeArr.Unified.sln --configuration Release --no-build
git diff --check
```

Windows packaging changes should also compile a local installer with Inno Setup and be tested for clean install, upgrade, shutdown, and uninstall behavior. Generated artifacts remain under `artifacts/` and must not be committed.

## Change scope

- Prefer small commits with one lifecycle, proxy, UI, test, or packaging concern.
- Add regression coverage for engine isolation and lifecycle behavior.
- Keep public routes namespaced as `/movies`, `/television`, or `/api/unified`.
- Preserve keyboard access, focus indicators, readable contrast, and reduced-motion behavior.
- Document user-visible changes in the README or relevant file under `docs/`.

## Reporting problems

Include the VynodeArr version, Windows version, affected domain, reproduction steps, and relevant gateway or engine logs. Remove API keys, download-client credentials, indexer credentials, media paths, and personal information before attaching logs.
