namespace VynodeArr.Gateway;

public static class UnifiedShell
{
    public const string Html = """
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>VynodeArr</title>
          <style>
            :root { color-scheme: dark; font-family: Inter, Segoe UI, sans-serif; background: #17191c; color: #f3f4f6; }
            * { box-sizing: border-box; }
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding-top: 46px; background: #17191c; }
            main { width: min(880px, calc(100% - 32px)); }
            .hero-logo { display: block; width: min(260px, 65vw); height: auto; margin: 0 0 16px; border-radius: 18%; }
            p { margin: 0 0 32px; color: #aeb4bd; font-size: 1.05rem; }
            .shell-nav { position: fixed; inset: 0 0 auto 0; z-index: 10; height: 46px; display: flex; align-items: center; gap: 4px; padding: 0 12px; border-bottom: 1px solid #41464d; background: #17191c; }
            .shell-nav .brand { width: 38px; height: 38px; margin-right: auto; display: grid; place-items: center; border-radius: 7px; }
            .shell-nav .brand img { width: 34px; height: 34px; border-radius: 7px; object-fit: cover; }
            .shell-nav .shell-link { min-height: 34px; display: inline-flex; align-items: center; padding: 0 12px; color: #cbd0d7; border: 1px solid transparent; border-radius: 4px; text-decoration: none; }
            .shell-nav .shell-link:hover { color: #fff; background: #292d32; }
            .shell-nav .shell-link:focus-visible { color: #fff; outline: 2px solid #78a9ff; outline-offset: 1px; }
            .shell-nav .shell-link[aria-current="page"] { color: #fff; background: #30353b; border-color: #555c65; }
            .domain-nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
            .domain-link { min-height: 180px; padding: 28px; display: flex; flex-direction: column; justify-content: end; gap: 8px; border: 1px solid #3b414a; border-radius: 8px; background: #22262b; color: inherit; text-decoration: none; transition: border-color .15s, background .15s; }
            .domain-link:hover, .domain-link:focus-visible { border-color: #72a7ff; background: #282d33; outline: 3px solid transparent; }
            strong { font-size: 1.45rem; }
            span { color: #aeb4bd; }
            .summary { margin-top: 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
            .panel { padding: 20px; border: 1px solid #343941; border-radius: 8px; background: #1d2024; }
            .panel h2 { margin: 0 0 4px; font-size: 1rem; }
            .state { margin-bottom: 16px; color: #8bc59b; font-size: .85rem; }
            .state.error { color: #f0a0a0; }
            dl { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: 7px 14px; }
            dt { color: #aeb4bd; } dd { margin: 0; font-variant-numeric: tabular-nums; }
            button { min-height: 36px; padding: 0 14px; border: 1px solid #555c65; border-radius: 4px; color: #f3f4f6; background: #30353b; font: inherit; cursor: pointer; }
            button:hover { background: #3a4047; }
            button:focus-visible { outline: 2px solid #78a9ff; outline-offset: 2px; }
            .engine-control { margin-top: 18px; }
            footer { margin-top: 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; color: #7f8792; font-size: .9rem; }
            .shutdown { border-color: #875151; color: #ffd8d8; background: #40272a; }
            .shutdown:hover { background: #523034; }
            @media (max-width: 620px) { .domain-nav, .summary { grid-template-columns: 1fr; } .domain-link { min-height: 130px; } .shell-nav { padding-inline: 8px; } .shell-nav .shell-link { padding-inline: 8px; font-size: 12px; } }
            @media (prefers-reduced-motion: reduce) { .domain-link { transition: none; } }
          </style>
        </head>
        <body>
          <nav class="shell-nav" aria-label="VynodeArr sections">
            <a class="brand" href="/" aria-label="VynodeArr dashboard"><img src="/assets/vynodearr.png" alt=""></a>
            <a class="shell-link" href="/" aria-current="page">Dashboard</a>
            <a class="shell-link" href="/movies/">Movies</a>
            <a class="shell-link" href="/television/">Television</a>
          </nav>
          <main>
            <img class="hero-logo" src="/assets/vynodearr.png" alt="VynodeArr">
            <p>One application. Two isolated media engines.</p>
            <nav class="domain-nav" aria-label="Media libraries">
              <a class="domain-link" href="/movies/"><strong>Movies</strong><span>Open the complete movie library and management interface.</span></a>
              <a class="domain-link" href="/television/"><strong>Television</strong><span>Open the complete series, season, and episode interface.</span></a>
            </nav>
            <section class="summary" aria-label="Library summary" aria-live="polite">
              <article class="panel" id="movie-summary"><h2>Movies</h2><div class="state">Loading…</div></article>
              <article class="panel" id="television-summary"><h2>Television</h2><div class="state">Loading…</div></article>
            </section>
            <footer><span>Movie and television data, commands, and settings remain independent.</span><button class="shutdown" id="shutdown-all" type="button">Shut down VynodeArr</button></footer>
          </main>
          <script>
            const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[character]));
            const render = (id, summary) => {
              const target = document.getElementById(id);
              const healthy = summary.state === 'Running' && !summary.error;
              const action = healthy || summary.state === 'Starting' ? 'stop' : 'start';
              const displayName = summary.domain === 'movie' ? 'VynodeArr Movies' : 'VynodeArr Television';
              target.innerHTML = `<h2>${displayName}</h2>
                <div class="state ${healthy ? '' : 'error'}">${escapeHtml(healthy ? `Running ${summary.version || ''}` : summary.error || summary.state)}</div>
                <dl><dt>Library items</dt><dd>${summary.libraryItems}</dd><dt>Monitored</dt><dd>${summary.monitoredItems}</dd><dt>Downloaded files</dt><dd>${summary.downloadedFiles}</dd><dt>Missing monitored</dt><dd>${summary.missingMonitored}</dd><dt>Queue</dt><dd>${summary.queueItems}</dd><dt>Health issues</dt><dd>${summary.healthIssues}</dd></dl>
                <button class="engine-control" type="button" data-domain="${escapeHtml(summary.domain)}" data-action="${action}">${action === 'stop' ? 'Stop' : 'Start'} ${summary.domain === 'movie' ? 'Movies' : 'Television'}</button>`;
            };
            let refreshTimer;
            const scheduleRefresh = (delay = 2500) => {
              clearTimeout(refreshTimer);
              refreshTimer = setTimeout(loadSummary, delay);
            };
            const loadSummary = () => fetch('/api/unified/v1/summary', { cache: 'no-store', headers: { Accept: 'application/json' } })
              .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
              .then((summary) => { render('movie-summary', summary.domains.movie); render('television-summary', summary.domains.television); })
              .catch((error) => document.querySelectorAll('.summary .state').forEach((node) => { node.className = 'state error'; node.textContent = `Summary unavailable: ${error.message}`; }))
              .finally(() => scheduleRefresh());
            loadSummary();
            document.querySelector('.summary').addEventListener('click', (event) => {
              const button = event.target.closest('.engine-control');
              if (!button) return;
              const label = button.dataset.domain === 'movie' ? 'Movies' : 'Television';
              if (button.dataset.action === 'stop' && !confirm(`Stop ${label}? Active operations in that domain will pause.`)) return;
              button.disabled = true;
              button.textContent = `${button.dataset.action === 'start' ? 'Starting' : 'Stopping'} ${label}...`;
              fetch(`/api/unified/v1/engines/${button.dataset.domain}/${button.dataset.action}`, { method: 'POST' })
                .then((response) => response.ok ? response : Promise.reject(new Error(`HTTP ${response.status}`)))
                .then(() => { clearTimeout(refreshTimer); return loadSummary(); })
                .catch((error) => { button.disabled = false; alert(`Unable to change ${label}: ${error.message}`); });
            });
            document.getElementById('shutdown-all').addEventListener('click', (event) => {
              if (!confirm('Shut down VynodeArr, including Movies and Television?')) return;
              event.currentTarget.disabled = true;
              fetch('/api/unified/v1/shutdown', { method: 'POST' })
                .then(() => { document.querySelector('main').innerHTML = '<h1>VynodeArr is shutting down...</h1><p>You can close this window. Use the VynodeArr tray icon to start it again.</p>'; })
                .catch((error) => { event.currentTarget.disabled = false; alert(`Unable to shut down VynodeArr: ${error.message}`); });
            });
          </script>
        </body>
        </html>
        """;
}
