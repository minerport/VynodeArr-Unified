using System.Net;
using VynodeArr.Gateway.Configuration;

namespace VynodeArr.Gateway;

public static class UnifiedShell
{
    public static string Render(UiOptions? ui = null, string version = "development")
    {
        ui ??= new UiOptions();
        var tokenLink = ui.TokensEnabled
            ? "<link id=\"vynodearr-token-styles\" rel=\"stylesheet\" href=\"/assets/vynodearr-tokens.v1.css\">"
            : string.Empty;
        var stylingClass = ui.NewShellStylingEnabled ? "vy-foundation-enabled" : "vy-foundation-disabled";
        var safeVersion = WebUtility.HtmlEncode(version);

        return $$"""
            <!doctype html>
            <html lang="en" data-vy-engine="shared" class="vy-engine-shared {{stylingClass}}">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <meta name="color-scheme" content="dark light">
              <title>VynodeArr</title>
              {{tokenLink}}
              <style>
                * { box-sizing: border-box; }
                html { min-width: 320px; background: var(--vy-surface-app, #17191c); color: var(--vy-text-primary, #f3f4f6); font-family: var(--vy-font-sans, Inter, "Segoe UI", sans-serif); }
                body { margin: 0; min-height: 100vh; padding-top: var(--vy-shell-height, 48px); background: var(--vy-surface-app, #17191c); }
                button, a { -webkit-tap-highlight-color: transparent; }
                button:focus-visible, a:focus-visible { outline: var(--vy-focus-ring, 3px solid #78a9ff); outline-offset: var(--vy-focus-offset, 2px); }
                .vy-visually-hidden { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
                .vy-dashboard-nav { position: fixed; inset: 0 0 auto 0; z-index: var(--vy-z-shell, 1000); min-height: var(--vy-shell-height, 48px); display: flex; align-items: center; gap: var(--vy-space-1, 4px); padding: 0 var(--vy-space-3, 12px); border-bottom: 1px solid var(--vy-border-subtle, #41464d); background: var(--vy-surface-sidebar, #17191c); box-shadow: 0 1px 6px rgb(0 0 0 / 18%); }
                .vy-dashboard-nav::after { content: ""; position: absolute; inset: auto 0 -1px; height: 2px; background: var(--vy-engine-shared, #8aa0b8); }
                .vy-brand { min-width: var(--vy-target-desktop, 40px); min-height: var(--vy-target-desktop, 40px); display: inline-flex; align-items: center; gap: var(--vy-space-2, 8px); margin-right: auto; color: var(--vy-text-primary, #f3f4f6); font-weight: 700; text-decoration: none; }
                .vy-brand img { width: 32px; height: 32px; border-radius: var(--vy-radius-md, 7px); object-fit: cover; }
                .vy-nav-link { min-height: var(--vy-target-desktop, 40px); display: inline-flex; align-items: center; padding: 0 var(--vy-space-3, 12px); color: var(--vy-text-secondary, #cbd0d7); border: 1px solid transparent; border-radius: var(--vy-radius-sm, 4px); text-decoration: none; }
                .vy-nav-link:hover { color: var(--vy-text-primary, #fff); background: var(--vy-surface-hover, #292d32); }
                .vy-nav-link[aria-current="page"] { color: var(--vy-text-primary, #fff); background: var(--vy-surface-selected, #30353b); border-color: var(--vy-engine-shared, #8aa0b8); }
                .vy-account { display: inline-flex; align-items: center; gap: var(--vy-space-2, 8px); margin-left: var(--vy-space-2, 8px); padding-left: var(--vy-space-3, 12px); border-left: 1px solid var(--vy-border-subtle, #41464d); color: var(--vy-text-secondary, #cbd0d7); font-size: .8rem; }
                .vy-account button { min-height: 32px; padding: 0 9px; color: inherit; border: 1px solid var(--vy-border-strong, #555c65); border-radius: 4px; background: transparent; cursor: pointer; }
                main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: var(--vy-space-5, 20px) 0 var(--vy-space-6, 24px); }
                .vy-identity { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--vy-space-4, 16px); padding-bottom: var(--vy-space-4, 16px); border-bottom: 1px solid var(--vy-border-subtle, #343941); }
                .vy-identity img { width: 58px; height: 58px; border-radius: var(--vy-radius-lg, 10px); object-fit: cover; }
                h1 { margin: 0; font-size: var(--vy-font-size-title, 1.65rem); line-height: 1.2; }
                .vy-subtitle { margin: var(--vy-space-1, 4px) 0 0; color: var(--vy-text-secondary, #aeb4bd); font-size: var(--vy-font-size-body, .875rem); }
                .vy-app-state { display: grid; justify-items: end; gap: 3px; color: var(--vy-text-secondary, #aeb4bd); font-size: var(--vy-font-size-meta, .75rem); }
                .vy-app-state strong { color: var(--vy-status-success, #4ade80); font-size: var(--vy-font-size-body, .875rem); }
                .vy-section-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--vy-space-3, 12px); margin: var(--vy-space-5, 20px) 0 var(--vy-space-3, 12px); }
                .vy-section-heading h2 { margin: 0; font-size: var(--vy-font-size-section, 1rem); }
                .vy-refresh { min-height: var(--vy-target-desktop, 40px); padding: 0 var(--vy-space-3, 12px); color: var(--vy-text-primary, #f3f4f6); border: 1px solid var(--vy-border-strong, #555c65); border-radius: var(--vy-radius-sm, 4px); background: var(--vy-surface-elevated, #30353b); font: inherit; cursor: pointer; }
                .vy-refresh:hover { background: var(--vy-surface-hover, #3a4047); }
                .vy-engine-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--vy-space-4, 16px); }
                .vy-engine-panel { min-width: 0; padding: var(--vy-space-4, 16px); border: 1px solid var(--vy-border-subtle, #343941); border-top: 3px solid var(--vy-engine-accent, #8aa0b8); border-radius: var(--vy-radius-md, 7px); background: var(--vy-surface-panel, #1d2024); box-shadow: var(--vy-shadow-raised, 0 6px 18px rgb(0 0 0 / 18%)); }
                .vy-engine-panel[data-engine="movie"] { --vy-engine-accent: var(--vy-engine-movies, #38bdf8); }
                .vy-engine-panel[data-engine="television"] { --vy-engine-accent: var(--vy-engine-television, #a78bfa); }
                .vy-engine-title { display: flex; align-items: center; justify-content: space-between; gap: var(--vy-space-3, 12px); }
                .vy-engine-title h3 { margin: 0; font-size: 1rem; }
                .vy-status { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; color: var(--vy-text-secondary, #aeb4bd); font-size: var(--vy-font-size-meta, .75rem); }
                .vy-status-icon { width: 9px; height: 9px; flex: 0 0 auto; border: 2px solid currentColor; border-radius: 50%; }
                .vy-status[data-tone="success"] { color: var(--vy-status-success, #4ade80); }
                .vy-status[data-tone="warning"] { color: var(--vy-status-warning, #fbbf24); }
                .vy-status[data-tone="error"] { color: var(--vy-status-error, #fb7185); }
                .vy-status[data-tone="offline"] { color: var(--vy-status-offline, #a8b2c1); }
                .vy-engine-message { min-height: 2.8em; margin: var(--vy-space-2, 8px) 0 var(--vy-space-3, 12px); overflow-wrap: anywhere; color: var(--vy-text-secondary, #aeb4bd); font-size: var(--vy-font-size-body, .875rem); }
                dl { margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px var(--vy-space-3, 12px); }
                dt { color: var(--vy-text-muted, #96a1af); } dd { margin: 0; color: var(--vy-text-primary, #f3f4f6); font-variant-numeric: tabular-nums; }
                .vy-actions { display: flex; flex-wrap: wrap; gap: var(--vy-space-2, 8px); margin-top: var(--vy-space-4, 16px); }
                .vy-button { min-height: var(--vy-target-desktop, 40px); display: inline-flex; align-items: center; justify-content: center; padding: 0 var(--vy-space-3, 12px); color: var(--vy-text-primary, #f3f4f6); border: 1px solid var(--vy-border-strong, #555c65); border-radius: var(--vy-radius-sm, 4px); background: var(--vy-surface-elevated, #30353b); font: inherit; text-decoration: none; cursor: pointer; }
                .vy-button:hover { background: var(--vy-surface-hover, #3a4047); }
                .vy-button:disabled { opacity: .6; cursor: progress; }
                .vy-calendar-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--vy-space-4, 16px); }
                .vy-calendar-panel { min-width: 0; overflow: hidden; border: 1px solid var(--vy-border-subtle, #343941); border-radius: var(--vy-radius-md, 7px); background: var(--vy-surface-panel, #1d2024); }
                .vy-calendar-header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--vy-space-3, 12px); padding: var(--vy-space-3, 12px) var(--vy-space-4, 16px); border-bottom: 1px solid var(--vy-border-subtle, #343941); }
                .vy-calendar-header h3 { margin: 0; font-size: 1rem; }
                .vy-calendar-header span { color: var(--vy-text-muted, #96a1af); font-size: var(--vy-font-size-meta, .75rem); }
                .vy-calendar-list { max-height: 480px; margin: 0; padding: 0; overflow: auto; list-style: none; }
                .vy-calendar-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px var(--vy-space-3, 12px); padding: var(--vy-space-3, 12px) var(--vy-space-4, 16px); border-bottom: 1px solid var(--vy-border-subtle, #343941); }
                .vy-calendar-item:last-child { border-bottom: 0; }
                .vy-calendar-title { min-width: 0; overflow: hidden; color: var(--vy-text-primary, #f3f4f6); font-weight: 600; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
                .vy-calendar-title:hover { text-decoration: underline; }
                .vy-calendar-subtitle, .vy-calendar-date { overflow: hidden; color: var(--vy-text-muted, #96a1af); font-size: var(--vy-font-size-meta, .75rem); text-overflow: ellipsis; white-space: nowrap; }
                .vy-status-badge { align-self: center; grid-column: 2; grid-row: 1 / span 2; display: inline-flex; align-items: center; min-height: 24px; padding: 2px 8px; border: 1px solid currentColor; border-radius: 999px; font-size: var(--vy-font-size-meta, .75rem); font-weight: 600; white-space: nowrap; }
                .vy-status-badge[data-status="downloaded-monitored"], .vy-status-badge[data-status="downloaded"] { color: var(--vy-status-success, #4ade80); }
                .vy-status-badge[data-status="downloaded-unmonitored"], .vy-status-badge[data-status="unmonitored"] { color: var(--vy-status-offline, #a8b2c1); }
                .vy-status-badge[data-status="missing-monitored"], .vy-status-badge[data-status="missing"] { color: var(--vy-status-error, #fb7185); }
                .vy-status-badge[data-status="missing-unmonitored"], .vy-status-badge[data-status="unreleased"], .vy-status-badge[data-status="unaired"] { color: var(--vy-text-muted, #96a1af); }
                .vy-status-badge[data-status="queued"], .vy-status-badge[data-status="downloading"] { color: var(--vy-status-warning, #fbbf24); }
                .vy-status-badge[data-status="on-air"] { color: var(--vy-engine-television, #a78bfa); }
                .vy-status-badge[data-status="premiere"] { color: var(--vy-status-info, #60a5fa); }
                .vy-calendar-empty { margin: 0; padding: var(--vy-space-4, 16px); color: var(--vy-text-muted, #96a1af); }
                footer { margin-top: var(--vy-space-5, 20px); display: flex; align-items: center; justify-content: space-between; gap: var(--vy-space-4, 16px); padding-top: var(--vy-space-4, 16px); border-top: 1px solid var(--vy-border-subtle, #343941); color: var(--vy-text-muted, #7f8792); font-size: var(--vy-font-size-meta, .8rem); }
                .vy-shutdown { border-color: var(--vy-status-error, #875151); }
                .vy-foundation-disabled main { width: min(880px, calc(100% - 32px)); }
                @media (max-width: 760px) { .vy-engine-grid, .vy-calendar-grid { grid-template-columns: 1fr; } .vy-identity { grid-template-columns: auto minmax(0, 1fr); } .vy-app-state { grid-column: 1 / -1; justify-items: start; } }
                @media (max-width: 540px) { main { width: min(100% - 20px, 1180px); padding-top: var(--vy-space-3, 12px); } .vy-brand span { display: none; } .vy-nav-link { padding-inline: var(--vy-space-2, 8px); font-size: .75rem; } .vy-identity img { width: 48px; height: 48px; } footer { align-items: stretch; flex-direction: column; } .vy-shutdown { width: 100%; } }
              </style>
            </head>
            <body>
              <nav class="vy-dashboard-nav vy-shell" aria-label="VynodeArr sections">
                <a class="vy-brand" href="/" aria-label="VynodeArr dashboard"><img src="/assets/vynodearr.png" alt=""><span>VynodeArr</span></a>
                <a class="vy-nav-link" href="/" aria-current="page">Dashboard</a>
                <a class="vy-nav-link" href="/movies/">Movies</a>
                <a class="vy-nav-link" href="/television/">Television</a>
                <span class="vy-account"><span id="account-name">Account</span><button id="logout" type="button">Log out</button></span>
              </nav>
              <main>
                <header class="vy-identity">
                  <img src="/assets/vynodearr.png" alt="VynodeArr">
                  <div><h1>VynodeArr</h1><p class="vy-subtitle">One application supervising two isolated media engines.</p></div>
                  <div class="vy-app-state"><strong>Gateway online</strong><span>Version {{safeVersion}}</span><span>Shared application context</span></div>
                </header>
                <section aria-labelledby="engine-status-heading">
                  <div class="vy-section-heading"><h2 id="engine-status-heading">Engine status</h2><button class="vy-refresh" id="refresh-status" type="button">Refresh status</button></div>
                  <div class="vy-engine-grid">
                    <article class="vy-engine-panel" data-engine="movie" id="movie-summary"><div class="vy-engine-title"><h3>Movies</h3><span class="vy-status" data-tone="offline"><span class="vy-status-icon" aria-hidden="true"></span><span>Loading</span></span></div><p class="vy-engine-message">Retrieving Movies engine status.</p></article>
                    <article class="vy-engine-panel" data-engine="television" id="television-summary"><div class="vy-engine-title"><h3>Television</h3><span class="vy-status" data-tone="offline"><span class="vy-status-icon" aria-hidden="true"></span><span>Loading</span></span></div><p class="vy-engine-message">Retrieving Television engine status.</p></article>
                  </div>
                  <div id="engine-status-announcer" class="vy-visually-hidden" aria-live="polite" aria-atomic="true"></div>
                </section>
                <section aria-labelledby="calendar-heading">
                  <div class="vy-section-heading"><h2 id="calendar-heading">Last 30 days</h2><button class="vy-refresh" id="refresh-calendar" type="button">Refresh calendar</button></div>
                  <div class="vy-calendar-grid">
                    <article class="vy-calendar-panel"><div class="vy-calendar-header"><h3>Movies calendar</h3><span id="movie-calendar-count">Loading</span></div><div id="movie-calendar"><p class="vy-calendar-empty">Retrieving Movies calendar.</p></div></article>
                    <article class="vy-calendar-panel"><div class="vy-calendar-header"><h3>Television calendar</h3><span id="television-calendar-count">Loading</span></div><div id="television-calendar"><p class="vy-calendar-empty">Retrieving Television calendar.</p></div></article>
                  </div>
                </section>
                <footer><span>Movie and television data, commands, settings, and databases remain independent.</span><button class="vy-button vy-shutdown" id="shutdown-all" type="button">Shut down VynodeArr</button></footer>
              </main>
              <script>
                const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
                let authSession = { role: 'Viewer', csrfToken: '' };
                const authReady = fetch('/api/auth/session', { cache: 'no-store', headers: { Accept: 'application/json' } })
                  .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
                  .then((session) => { authSession = session; document.getElementById('account-name').textContent = `${session.username} · ${session.role}`; });
                const previousStates = new Map();
                const statePresentation = (summary) => {
                  const state = String(summary.state || 'Unavailable');
                  if (summary.error) return { tone: 'error', label: state === 'Running' ? 'Degraded' : 'Unavailable', message: summary.error };
                  if (state === 'Running') return { tone: 'success', label: 'Running', message: summary.version ? `Version ${summary.version}` : 'Connected and responding.' };
                  if (state === 'Starting') return { tone: 'warning', label: 'Starting', message: 'The engine is starting.' };
                  if (state === 'Stopped') return { tone: 'offline', label: 'Stopped', message: 'The engine is stopped.' };
                  return { tone: 'error', label: state, message: 'The engine is unavailable.' };
                };
                const render = (id, summary) => {
                  const target = document.getElementById(id);
                  const presentation = statePresentation(summary);
                  const healthy = summary.state === 'Running' && !summary.error;
                  const action = healthy || summary.state === 'Starting' ? 'stop' : 'start';
                  const label = summary.domain === 'movie' ? 'Movies' : 'Television';
                  const statusKey = `${presentation.label}:${presentation.message}`;
                  if (previousStates.has(summary.domain) && previousStates.get(summary.domain) !== statusKey) document.getElementById('engine-status-announcer').textContent = `${label} status changed to ${presentation.label}.`;
                  previousStates.set(summary.domain, statusKey);
                  target.innerHTML = `<div class="vy-engine-title"><h3>${label}</h3><span class="vy-status" data-tone="${presentation.tone}"><span class="vy-status-icon" aria-hidden="true"></span><span>${escapeHtml(presentation.label)}</span></span></div>
                    <p class="vy-engine-message">${escapeHtml(presentation.message)}</p>
                    <dl><dt>Library items</dt><dd>${summary.libraryItems}</dd><dt>Monitored</dt><dd>${summary.monitoredItems}</dd><dt>Downloaded files</dt><dd>${summary.downloadedFiles}</dd><dt>Missing monitored</dt><dd>${summary.missingMonitored}</dd><dt>Queue</dt><dd>${summary.queueItems}</dd><dt>Health issues</dt><dd>${summary.healthIssues}</dd></dl>
                    <div class="vy-actions"><a class="vy-button" href="${summary.domain === 'movie' ? '/movies/' : '/television/'}">Open ${label}</a><a class="vy-button" href="${summary.domain === 'movie' ? '/movies/system/status' : '/television/system/status'}">${label} System</a>${authSession.role === 'Administrator' ? `<button class="vy-button engine-control" type="button" data-domain="${escapeHtml(summary.domain)}" data-action="${action}">${action === 'stop' ? 'Stop' : 'Start'} ${label}</button>` : ''}</div>`;
                };
                let refreshTimer;
                const controlHeaders = () => ({ 'X-VynodeArr-CSRF': authSession.csrfToken });
                const scheduleRefresh = (delay = 2500) => { clearTimeout(refreshTimer); refreshTimer = setTimeout(loadSummary, delay); };
                const loadSummary = () => fetch('/api/unified/v1/summary', { cache: 'no-store', headers: { Accept: 'application/json' } })
                  .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
                  .then((summary) => { render('movie-summary', summary.domains.movie); render('television-summary', summary.domains.television); })
                  .catch((error) => document.querySelectorAll('.vy-engine-panel').forEach((panel) => { const label = panel.dataset.engine === 'movie' ? 'Movies' : 'Television'; panel.querySelector('.vy-status').dataset.tone = 'error'; panel.querySelector('.vy-status span:last-child').textContent = 'Unavailable'; panel.querySelector('.vy-engine-message').textContent = `${label} summary unavailable: ${error.message}`; }))
                  .finally(() => scheduleRefresh());
                authReady.then(loadSummary);
                let calendarTimer;
                const renderCalendar = (domain, targetId) => {
                  const target = document.getElementById(targetId);
                  const count = document.getElementById(`${targetId}-count`);
                  const items = domain?.items || [];
                  count.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
                  if (domain?.error) { target.innerHTML = `<p class="vy-calendar-empty">Calendar unavailable: ${escapeHtml(domain.error)}</p>`; return; }
                  if (!items.length) { target.innerHTML = '<p class="vy-calendar-empty">No calendar items in the last 30 days.</p>'; return; }
                  target.innerHTML = `<ul class="vy-calendar-list">${items.map((item) => `<li class="vy-calendar-item"><a class="vy-calendar-title" href="${escapeHtml(item.link)}">${escapeHtml(item.title)}</a><span class="vy-calendar-subtitle">${escapeHtml(item.subtitle || '')}</span><time class="vy-calendar-date" datetime="${escapeHtml(item.date)}">${new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time><span class="vy-status-badge" data-status="${escapeHtml(item.statusKey)}">${escapeHtml(item.status)}</span></li>`).join('')}</ul>`;
                };
                const loadCalendar = () => fetch('/api/unified/v1/calendar', { cache: 'no-store', headers: { Accept: 'application/json' } })
                  .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
                  .then((calendar) => { renderCalendar(calendar.domains.movie, 'movie-calendar'); renderCalendar(calendar.domains.television, 'television-calendar'); })
                  .catch((error) => ['movie', 'television'].forEach((domain) => { document.getElementById(`${domain}-calendar`).innerHTML = `<p class="vy-calendar-empty">Calendar unavailable: ${escapeHtml(error.message)}</p>`; }))
                  .finally(() => { clearTimeout(calendarTimer); calendarTimer = setTimeout(loadCalendar, 300000); });
                authReady.then(loadCalendar);
                document.getElementById('refresh-status').addEventListener('click', () => { clearTimeout(refreshTimer); loadSummary(); });
                document.getElementById('refresh-calendar').addEventListener('click', () => { clearTimeout(calendarTimer); loadCalendar(); });
                document.querySelector('.vy-engine-grid').addEventListener('click', (event) => {
                  const button = event.target.closest('.engine-control'); if (!button) return;
                  const label = button.dataset.domain === 'movie' ? 'Movies' : 'Television';
                  if (button.dataset.action === 'stop' && !confirm(`Stop ${label}? Active operations in that domain will pause.`)) return;
                  button.disabled = true; button.textContent = `${button.dataset.action === 'start' ? 'Starting' : 'Stopping'} ${label}...`;
                  fetch(`/api/unified/v1/engines/${button.dataset.domain}/${button.dataset.action}`, { method: 'POST', headers: controlHeaders() })
                    .then((response) => response.ok ? response : Promise.reject(new Error(`HTTP ${response.status}`)))
                    .then(() => { clearTimeout(refreshTimer); return loadSummary(); })
                    .catch((error) => { button.disabled = false; alert(`Unable to change ${label}: ${error.message}`); });
                });
                document.getElementById('shutdown-all').addEventListener('click', (event) => {
                  if (!confirm('Shut down VynodeArr, including Movies and Television?')) return;
                  event.currentTarget.disabled = true;
                  fetch('/api/unified/v1/shutdown', { method: 'POST', headers: controlHeaders() })
                    .then(() => { document.querySelector('main').innerHTML = '<h1>VynodeArr is shutting down...</h1><p class="vy-subtitle">You can close this window. Use the VynodeArr tray icon or service controls to start it again.</p>'; })
                    .catch((error) => { event.currentTarget.disabled = false; alert(`Unable to shut down VynodeArr: ${error.message}`); });
                });
                authReady.then(() => { if (authSession.role !== 'Administrator') document.getElementById('shutdown-all').hidden = true; });
                document.getElementById('logout').addEventListener('click', () => authReady.then(() => fetch('/api/auth/logout', { method: 'POST', headers: controlHeaders(), redirect: 'manual' })).then(() => location.assign('/login')));
              </script>
            </body>
            </html>
            """;
    }
}
