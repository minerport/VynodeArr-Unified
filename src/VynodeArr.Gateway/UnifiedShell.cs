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
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #17191c; }
            main { width: min(880px, calc(100% - 32px)); }
            h1 { margin: 0 0 8px; font-size: clamp(2rem, 6vw, 3.5rem); letter-spacing: -.04em; }
            p { margin: 0 0 32px; color: #aeb4bd; font-size: 1.05rem; }
            nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
            a { min-height: 180px; padding: 28px; display: flex; flex-direction: column; justify-content: end; gap: 8px; border: 1px solid #3b414a; border-radius: 8px; background: #22262b; color: inherit; text-decoration: none; transition: border-color .15s, background .15s; }
            a:hover, a:focus-visible { border-color: #72a7ff; background: #282d33; outline: 3px solid transparent; }
            strong { font-size: 1.45rem; }
            span { color: #aeb4bd; }
            .summary { margin-top: 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
            .panel { padding: 20px; border: 1px solid #343941; border-radius: 8px; background: #1d2024; }
            .panel h2 { margin: 0 0 4px; font-size: 1rem; }
            .state { margin-bottom: 16px; color: #8bc59b; font-size: .85rem; }
            .state.error { color: #f0a0a0; }
            dl { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: 7px 14px; }
            dt { color: #aeb4bd; } dd { margin: 0; font-variant-numeric: tabular-nums; }
            footer { margin-top: 22px; color: #7f8792; font-size: .9rem; }
            @media (max-width: 620px) { nav, .summary { grid-template-columns: 1fr; } a { min-height: 130px; } }
            @media (prefers-reduced-motion: reduce) { a { transition: none; } }
          </style>
        </head>
        <body>
          <main>
            <h1>VynodeArr</h1>
            <p>One application. Two isolated media engines.</p>
            <nav aria-label="Media libraries">
              <a href="/movies/"><strong>Movies</strong><span>Open the complete movie library and management interface.</span></a>
              <a href="/television/"><strong>Television</strong><span>Open the complete series, season, and episode interface.</span></a>
            </nav>
            <section class="summary" aria-label="Library summary" aria-live="polite">
              <article class="panel" id="movie-summary"><h2>Movies</h2><div class="state">Loading…</div></article>
              <article class="panel" id="television-summary"><h2>Television</h2><div class="state">Loading…</div></article>
            </section>
            <footer>Movie and television data, commands, and settings remain independent.</footer>
          </main>
          <script>
            const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[character]));
            const render = (id, summary) => {
              const target = document.getElementById(id);
              const healthy = summary.state === 'Running' && !summary.error;
              target.innerHTML = `<h2>${escapeHtml(summary.application || summary.domain)}</h2>
                <div class="state ${healthy ? '' : 'error'}">${escapeHtml(healthy ? `Running ${summary.version || ''}` : summary.error || summary.state)}</div>
                <dl><dt>Library items</dt><dd>${summary.libraryItems}</dd><dt>Monitored</dt><dd>${summary.monitoredItems}</dd><dt>Downloaded files</dt><dd>${summary.downloadedFiles}</dd><dt>Missing monitored</dt><dd>${summary.missingMonitored}</dd><dt>Queue</dt><dd>${summary.queueItems}</dd><dt>Health issues</dt><dd>${summary.healthIssues}</dd></dl>`;
            };
            fetch('/api/unified/v1/summary', { headers: { Accept: 'application/json' } })
              .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
              .then((summary) => { render('movie-summary', summary.domains.movie); render('television-summary', summary.domains.television); })
              .catch((error) => document.querySelectorAll('.summary .state').forEach((node) => { node.className = 'state error'; node.textContent = `Summary unavailable: ${error.message}`; }));
          </script>
        </body>
        </html>
        """;
}
