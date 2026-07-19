using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Proxy;

public static class NativeShellBranding
{
    private const string HeadContent = """
        <style id="vynodearr-shell-style">
          :root { --vynodearr-shell-height: 46px; }
          #vynodearr-shell { position: fixed; inset: 0 0 auto 0; z-index: 2147483647; height: var(--vynodearr-shell-height); display: flex; align-items: center; gap: 4px; padding: 0 12px; color: #f5f7fa; background: #17191c; border-bottom: 1px solid #41464d; box-shadow: 0 1px 4px rgb(0 0 0 / 28%); font: 600 14px/1 Inter, "Segoe UI", sans-serif; }
          #vynodearr-shell .vynodearr-brand { margin-right: auto; padding: 8px 10px; color: #fff; font-size: 16px; letter-spacing: -.02em; text-decoration: none; }
          #vynodearr-shell .vynodearr-link { min-height: 34px; display: inline-flex; align-items: center; padding: 0 12px; color: #cbd0d7; border: 1px solid transparent; border-radius: 4px; text-decoration: none; }
          #vynodearr-shell .vynodearr-link:hover { color: #fff; background: #292d32; }
          #vynodearr-shell .vynodearr-link:focus-visible { color: #fff; outline: 2px solid #78a9ff; outline-offset: 1px; }
          #vynodearr-shell .vynodearr-link[aria-current="page"] { color: #fff; background: #30353b; border-color: #555c65; }
          body > #root { position: relative; top: var(--vynodearr-content-offset, var(--vynodearr-shell-height)); height: calc(100% - var(--vynodearr-content-offset, var(--vynodearr-shell-height))) !important; }
          #vynodearr-import-notice { position: fixed; inset: var(--vynodearr-shell-height) 0 auto 0; z-index: 2147483646; min-height: 44px; display: flex; align-items: center; justify-content: center; padding: 8px 16px; color: #f8e7b2; background: #3d3420; border-bottom: 1px solid #796a3f; font: 600 13px/1.35 Inter, "Segoe UI", sans-serif; text-align: center; }
          @media (max-width: 520px) {
            #vynodearr-shell { padding: 0 5px; }
            #vynodearr-shell .vynodearr-brand { padding-inline: 6px; font-size: 14px; }
            #vynodearr-shell .vynodearr-link { padding-inline: 8px; font-size: 12px; }
          }
        </style>
        """;

    public static string Transform(string html, EngineDomain domain)
    {
        var legacyName = domain == EngineDomain.Movie ? "Radarr" : "Sonarr";
        var productName = domain == EngineDomain.Movie ? "VynodeArr Movies" : "VynodeArr Television";
        var activePath = domain == EngineDomain.Movie ? "/movies/" : "/television/";
        var activePathWithoutSlash = activePath.TrimEnd('/');
        var movieImportNotice = domain == EngineDomain.Movie
            ? """
              if (location.pathname.startsWith('/movies/add/import')) {
                document.documentElement.style.setProperty('--vynodearr-content-offset', '90px');
                const notice = document.createElement('div');
                notice.id = 'vynodearr-import-notice';
                notice.setAttribute('role', 'note');
                notice.textContent = 'Library Import requires one folder per movie. Loose video files directly inside the root folder are not listed; organize each movie into its own folder first.';
                document.body.appendChild(notice);
              }
              """
            : string.Empty;
        var nativeBrandStyle = $$"""
            <style id="vynodearr-native-brand-style">
              #root a[href="{{activePath}}"]:has(> img) > img,
              #root a[href="{{activePathWithoutSlash}}"]:has(> img) > img { display: none !important; }
              #root a[href="{{activePath}}"]:has(> img)::after,
              #root a[href="{{activePathWithoutSlash}}"]:has(> img)::after { content: "{{productName}}"; display: inline-block; padding: 8px 12px; color: #f5f7fa; font: 700 17px/1 Inter, "Segoe UI", sans-serif; white-space: nowrap; }
            </style>
            """;
        var navigation = $$"""
            <nav id="vynodearr-shell" aria-label="VynodeArr sections">
              <a class="vynodearr-brand" href="/">VynodeArr</a>
              <a class="vynodearr-link" href="/">Dashboard</a>
              <a class="vynodearr-link" href="/movies/"{{(activePath == "/movies/" ? " aria-current=\"page\"" : string.Empty)}}>Movies</a>
              <a class="vynodearr-link" href="/television/"{{(activePath == "/television/" ? " aria-current=\"page\"" : string.Empty)}}>Television</a>
            </nav>
            <script id="vynodearr-branding-script">
            (() => {
              const legacy = '{{legacyName}}';
              const product = '{{productName}}';
              const replace = (value) => typeof value === 'string' ? value.replaceAll(legacy, product) : value;
              const brand = (root) => {
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
                const nodes = [];
                while (walker.nextNode()) nodes.push(walker.currentNode);
                nodes.forEach((node) => { if (!node.parentElement?.closest('#vynodearr-shell') && node.data.includes(legacy)) node.data = replace(node.data); });
                root.querySelectorAll?.('[title],[aria-label],[alt]').forEach((element) => {
                  for (const name of ['title', 'aria-label', 'alt']) {
                    const value = element.getAttribute(name);
                    if (value?.includes(legacy)) element.setAttribute(name, replace(value));
                  }
                });
                document.title = replace(document.title) || product;
              };
              const observer = new MutationObserver((entries) => entries.forEach((entry) => entry.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && !node.closest?.('#vynodearr-shell')) brand(node);
                else if (node.nodeType === Node.TEXT_NODE && node.data.includes(legacy)) node.data = replace(node.data);
              })));
              brand(document.body);
              observer.observe(document.body, { childList: true, subtree: true });
              {{movieImportNotice}}
            })();
            </script>
            """;

        var transformed = html
            .Replace($"<title>{legacyName}</title>", $"<title>{productName}</title>", StringComparison.Ordinal)
            .Replace($"content=\"{legacyName}\"", $"content=\"{productName}\"", StringComparison.Ordinal);
        transformed = transformed.Replace("</head>", $"{HeadContent}{nativeBrandStyle}</head>", StringComparison.OrdinalIgnoreCase);
        return transformed.Replace("<body>", $"<body>{navigation}", StringComparison.OrdinalIgnoreCase);
    }
}
