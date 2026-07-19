using VynodeArr.Gateway.Proxy;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class NativeShellBrandingTests
{
    [Theory]
    [InlineData(EngineDomain.Movie, "Radarr", "VynodeArr Movies", "/movies/")]
    [InlineData(EngineDomain.Television, "Sonarr", "VynodeArr Television", "/television/")]
    public void AddsUnifiedNavigationAndRebrandsVisibleMetadata(
        EngineDomain domain,
        string compatibilityName,
        string productName,
        string activePath)
    {
        var html = $"<html><head><meta name=\"description\" content=\"{compatibilityName}\"><title>{compatibilityName}</title></head><body><script>window.{compatibilityName}={{}};</script><div id=\"root\"></div></body></html>";

        var result = NativeShellBranding.Transform(html, domain);

        Assert.Contains($"<title>{productName}</title>", result, StringComparison.Ordinal);
        Assert.Contains("aria-label=\"VynodeArr sections\"", result, StringComparison.Ordinal);
        Assert.Contains($"href=\"{activePath}\" aria-current=\"page\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/\">Dashboard</a>", result, StringComparison.Ordinal);
        Assert.Contains($"window.{compatibilityName}", result, StringComparison.Ordinal);
        Assert.Equal(
            domain == EngineDomain.Movie,
            result.Contains("Library Import requires one folder per movie", StringComparison.Ordinal));
    }
}
