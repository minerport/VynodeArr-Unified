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
            footer { margin-top: 22px; color: #7f8792; font-size: .9rem; }
            @media (max-width: 620px) { nav { grid-template-columns: 1fr; } a { min-height: 130px; } }
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
            <footer>Movie and television data, commands, and settings remain independent.</footer>
          </main>
        </body>
        </html>
        """;
}
