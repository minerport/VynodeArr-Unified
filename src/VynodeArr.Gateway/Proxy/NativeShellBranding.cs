using VynodeArr.Gateway.Configuration;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Proxy;

public static class NativeShellBranding
{
    private const string LegacyStyle = """
        <style id="vynodearr-shell-style">
          :root { --vynodearr-shell-height: 46px; }
          #vynodearr-shell { position: fixed; inset: 0 0 auto 0; z-index: 2147483647; height: var(--vynodearr-shell-height); display: flex; align-items: center; gap: 4px; padding: 0 12px; color: #f5f7fa; background: #17191c; border-bottom: 1px solid #41464d; box-shadow: 0 1px 4px rgb(0 0 0 / 28%); font: 600 14px/1 Inter, "Segoe UI", sans-serif; }
          #vynodearr-shell .vynodearr-brand { width: 38px; height: 38px; margin-right: auto; display: grid; place-items: center; border-radius: 7px; }
          #vynodearr-shell .vynodearr-brand img { width: 34px; height: 34px; border-radius: 7px; object-fit: cover; }
          #vynodearr-shell .vynodearr-link { min-height: 34px; display: inline-flex; align-items: center; padding: 0 12px; color: #cbd0d7; border: 1px solid transparent; border-radius: 4px; text-decoration: none; }
          #vynodearr-shell .vynodearr-link:hover { color: #fff; background: #292d32; }
          #vynodearr-shell .vynodearr-link:focus-visible { color: #fff; outline: 2px solid #78a9ff; outline-offset: 1px; }
          #vynodearr-shell .vynodearr-link[aria-current="page"] { color: #fff; background: #30353b; border-color: #555c65; }
          body > #root { position: relative; top: var(--vynodearr-content-offset, var(--vynodearr-shell-height)); height: calc(100% - var(--vynodearr-content-offset, var(--vynodearr-shell-height))) !important; }
          @media (max-width: 520px) { #vynodearr-shell { padding: 0 5px; } #vynodearr-shell .vynodearr-brand { width: 36px; } #vynodearr-shell .vynodearr-link { padding-inline: 8px; font-size: 12px; } }
        </style>
        """;

    private const string FoundationStyle = """
        <style id="vynodearr-shell-style" data-vy-adapter-version="1">
          :root { --vynodearr-content-offset: var(--vy-shell-height, 48px); scroll-padding-top: calc(var(--vy-shell-height, 48px) + 8px); }
          .vy-shell-header { position: fixed; inset: 0 0 auto 0; z-index: var(--vy-z-shell, 1000); min-height: var(--vy-shell-height, 48px); display: flex; align-items: center; gap: var(--vy-space-1, 4px); padding: 0 var(--vy-space-3, 12px); color: var(--vy-text-primary, #f2f5f8); background: var(--vy-surface-sidebar, #171c24); border-bottom: 1px solid var(--vy-border-subtle, #303946); box-shadow: 0 1px 6px rgb(0 0 0 / 18%); font: 600 var(--vy-font-size-body, 14px)/1 var(--vy-font-sans, sans-serif); }
          .vy-shell-header::after { content: ""; position: absolute; inset: auto 0 -1px 0; height: 2px; background: var(--vy-engine-accent, #8aa0b8); }
          .vy-shell-brand { width: var(--vy-target-desktop, 40px); min-height: var(--vy-target-desktop, 40px); display: grid; place-items: center; border-radius: var(--vy-radius-md, 7px); }
          .vy-shell-brand img { width: 32px; height: 32px; border-radius: var(--vy-radius-md, 7px); object-fit: cover; }
          .vy-engine-badge { margin-right: auto; display: inline-flex; align-items: center; gap: var(--vy-space-2, 8px); min-height: 28px; padding: 0 var(--vy-space-3, 12px); color: var(--vy-text-primary, #f2f5f8); border: 1px solid var(--vy-border-strong, #526074); border-left: 3px solid var(--vy-engine-accent, #8aa0b8); border-radius: 999px; background: var(--vy-surface-panel, #1d232d); font-size: var(--vy-font-size-meta, 12px); letter-spacing: .02em; }
          .vy-engine-badge::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--vy-engine-accent, #8aa0b8); forced-color-adjust: none; }
          .vy-shell-link { min-height: var(--vy-target-desktop, 40px); display: inline-flex; align-items: center; padding: 0 var(--vy-space-3, 12px); color: var(--vy-text-secondary, #b8c0cb); border: 1px solid transparent; border-radius: var(--vy-radius-sm, 4px); text-decoration: none; transition: color var(--vy-motion-fast, 120ms) var(--vy-ease-standard, ease), background var(--vy-motion-fast, 120ms) var(--vy-ease-standard, ease); }
          .vy-shell-link:hover { color: var(--vy-text-primary, #f2f5f8); background: var(--vy-surface-hover, #2b3441); }
          .vy-shell-link:focus-visible, .vy-shell-brand:focus-visible { outline: var(--vy-focus-ring, 3px solid #93c5fd); outline-offset: var(--vy-focus-offset, 2px); }
          .vy-shell-link[aria-current="page"] { color: var(--vy-text-primary, #f2f5f8); background: var(--vy-surface-selected, #303b4b); border-color: var(--vy-engine-accent, #8aa0b8); }
          a[href$="/system/updates"], a[href$="/system/updates/"] { display: none !important; }
          body > #root { position: relative; top: var(--vynodearr-content-offset); height: calc(100% - var(--vynodearr-content-offset)) !important; }
          @media (max-width: 620px) { .vy-shell-header { padding-inline: var(--vy-space-1, 4px); } .vy-shell-brand { width: 36px; } .vy-engine-badge { max-width: 116px; padding-inline: var(--vy-space-2, 8px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .vy-shell-link { padding-inline: var(--vy-space-2, 8px); font-size: 12px; } }
          @media (max-width: 430px) { .vy-shell-link { padding-inline: 6px; } .vy-engine-badge { max-width: 92px; } }
          @media (forced-colors: active) { .vy-shell-header::after, .vy-engine-badge::before { forced-color-adjust: auto; } }
        </style>
        """;

    public static string Transform(string html, EngineDomain domain, UiOptions? ui = null)
    {
        ui ??= new UiOptions();
        var compatibilityName = domain == EngineDomain.Movie ? "Radarr" : "Sonarr";
        var productName = domain == EngineDomain.Movie ? "VynodeArr Movies" : "VynodeArr Television";
        var engineKey = domain == EngineDomain.Movie ? "movies" : "television";
        var activePath = domain == EngineDomain.Movie ? "/movies/" : "/television/";
        var tokenLink = ui.TokensEnabled
            ? "<link id=\"vynodearr-token-styles\" rel=\"stylesheet\" href=\"/assets/vynodearr-tokens.v1.css?rev=2\">"
            : string.Empty;
        var nativeThemeLink = ui.TokensEnabled && ui.NewShellStylingEnabled
            ? "<link id=\"vynodearr-native-styles\" rel=\"stylesheet\" href=\"/assets/vynodearr-native.v2.css?rev=4\">"
            : string.Empty;
        var style = ui.NewShellStylingEnabled ? FoundationStyle : LegacyStyle;
        var metadata = ui.NewShellStylingEnabled
            ? BuildMetadata(productName, compatibilityName, activePath)
            : string.Empty;
        var navigation = ui.NewShellStylingEnabled
            ? BuildFoundationNavigation(productName, activePath)
            : BuildLegacyNavigation(activePath);
        var transformed = AddEngineContext(html, engineKey);
        transformed = ReplaceExactMetadata(transformed, compatibilityName, productName);
        transformed = transformed.Replace("</head>", $"{tokenLink}{nativeThemeLink}{metadata}{style}</head>", StringComparison.OrdinalIgnoreCase);
        return transformed.Replace("<body>", $"<body>{navigation}", StringComparison.OrdinalIgnoreCase);
    }

    private static string AddEngineContext(string html, string engineKey)
    {
        var marker = $"data-vy-engine=\"{engineKey}\" class=\"vy-engine-{engineKey}\"";
        var htmlStart = html.IndexOf("<html", StringComparison.OrdinalIgnoreCase);
        if (htmlStart < 0)
        {
            return html;
        }

        var insertAt = htmlStart + "<html".Length;
        return html.Insert(insertAt, $" {marker}");
    }

    private static string ReplaceExactMetadata(string html, string compatibilityName, string productName) => html
        .Replace($"<title>{compatibilityName}</title>", $"<title>{productName}</title>", StringComparison.Ordinal)
        .Replace($"content=\"{compatibilityName}\"", $"content=\"{productName}\"", StringComparison.Ordinal);

    public static string PresentText(string value) => value
        .Replace("Radarr", "VynodeArr Movies", StringComparison.OrdinalIgnoreCase)
        .Replace("Sonarr", "VynodeArr Television", StringComparison.OrdinalIgnoreCase);

    private static string BuildMetadata(
        string productName,
        string compatibilityName,
        string activePath) => $$"""
        <link id="vynodearr-favicon" rel="icon" type="image/png" href="/assets/vynodearr.png">
        <meta name="application-name" content="{{productName}}">
        <script id="vynodearr-native-presentation">
          (() => {
            const compatibilityName = {{System.Text.Json.JsonSerializer.Serialize(compatibilityName)}};
            const productName = {{System.Text.Json.JsonSerializer.Serialize(productName)}};
            const updatePath = {{System.Text.Json.JsonSerializer.Serialize($"{activePath}system/updates")}};
            const replaceProductName = (value) =>
              typeof value === 'string'
                ? value.replace(new RegExp(compatibilityName, 'gi'), productName)
                : value;
            const applyTitle = () => {
              const suffix = ' · {{productName}}';
              const raw = document.title
                .replace(/\s*[-·]\s*{{compatibilityName}}\s*$/i, '')
                .replace(/^{{compatibilityName}}$/i, '');
              const page = raw === '{{productName}}' ? '' : raw;
              const next = !page ? '{{productName}}' : page.endsWith(suffix) ? page : `${page}${suffix}`;
              if (document.title !== next) document.title = next;
            };
            const presentNode = (root) => {
              if (!(root instanceof Node)) return;
              if (root.nodeType === Node.TEXT_NODE) {
                const parent = root.parentElement;
                if (parent && !parent.closest('script, style, textarea, [contenteditable="true"]')) {
                  const next = replaceProductName(root.nodeValue);
                  if (next !== root.nodeValue) root.nodeValue = next;
                }
                return;
              }
              if (!(root instanceof Element)) return;
              if (root.matches('a[href$="/system/updates"], a[href$="/system/updates/"]')) {
                root.remove();
                return;
              }
              root.querySelectorAll('a[href$="/system/updates"], a[href$="/system/updates/"]').forEach((link) => link.remove());
              const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
              while (walker.nextNode()) presentNode(walker.currentNode);
              [root, ...root.querySelectorAll('[title], [aria-label], [alt]')].forEach((element) => {
                for (const attribute of ['title', 'aria-label', 'alt']) {
                  if (element.hasAttribute(attribute)) {
                    element.setAttribute(attribute, replaceProductName(element.getAttribute(attribute)));
                  }
                }
              });
            };
            if (location.pathname.replace(/\/$/, '').toLowerCase() === updatePath.toLowerCase()) {
              location.replace('{{activePath}}system/status');
              return;
            }
            const start = () => {
              applyTitle();
              presentNode(document.body);
              new MutationObserver((records) => {
                applyTitle();
                for (const record of records) {
                  if (record.type === 'characterData') presentNode(record.target);
                  record.addedNodes.forEach(presentNode);
                }
              }).observe(document.body, { childList: true, subtree: true, characterData: true });
            };
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', start, { once: true });
            } else {
              start();
            }
          })();
        </script>
        """;

    private static string BuildFoundationNavigation(string productName, string activePath) => $$"""
        <nav id="vynodearr-shell" class="vy-shell vy-shell-header" aria-label="VynodeArr sections">
          <a class="vy-shell-brand" href="/" aria-label="VynodeArr dashboard"><img src="/assets/vynodearr.png" alt=""></a>
          <span class="vy-engine-badge" aria-label="Current engine: {{productName}}">{{productName}}</span>
          <a class="vy-shell-link" href="/">Dashboard</a>
          <a class="vy-shell-link" href="/movies/"{{(activePath == "/movies/" ? " aria-current=\"page\"" : string.Empty)}}>Movies</a>
          <a class="vy-shell-link" href="/television/"{{(activePath == "/television/" ? " aria-current=\"page\"" : string.Empty)}}>Television</a>
        </nav>
        """;

    private static string BuildLegacyNavigation(string activePath) => $$"""
        <nav id="vynodearr-shell" aria-label="VynodeArr sections">
          <a class="vynodearr-brand" href="/" aria-label="VynodeArr dashboard"><img src="/assets/vynodearr.png" alt=""></a>
          <a class="vynodearr-link" href="/">Dashboard</a>
          <a class="vynodearr-link" href="/movies/"{{(activePath == "/movies/" ? " aria-current=\"page\"" : string.Empty)}}>Movies</a>
          <a class="vynodearr-link" href="/television/"{{(activePath == "/television/" ? " aria-current=\"page\"" : string.Empty)}}>Television</a>
        </nav>
        """;

}
