using VynodeArr.Gateway.Proxy;
using VynodeArr.Gateway.Configuration;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class NativeShellBrandingTests
{
    [Theory]
    [InlineData(EngineDomain.Movie, "Radarr", "VynodeArr Movies", "/movies/")]
    [InlineData(EngineDomain.Television, "Sonarr", "VynodeArr Television", "/television/")]
    public void AddsUnifiedNavigationAndTargetsOnlyProductMetadata(
        EngineDomain domain,
        string compatibilityName,
        string productName,
        string activePath)
    {
        var userContent = $"A user named this library {compatibilityName} Archive";
        var html = $"<html lang=\"en\"><head><meta name=\"description\" content=\"{compatibilityName}\"><title>{compatibilityName}</title></head><body><script>window.{compatibilityName}={{}};</script><div id=\"root\">{userContent}</div></body></html>";

        var result = NativeShellBranding.Transform(html, domain, new UiOptions());

        Assert.Contains($"<title>{productName}</title>", result, StringComparison.Ordinal);
        Assert.Contains($"data-vy-engine=\"{(domain == EngineDomain.Movie ? "movies" : "television")}\"", result, StringComparison.Ordinal);
        Assert.Contains("aria-label=\"VynodeArr sections\"", result, StringComparison.Ordinal);
        Assert.Contains($"aria-label=\"Current engine: {productName}\"", result, StringComparison.Ordinal);
        Assert.Contains("src=\"/assets/vynodearr.png\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/assets/vynodearr-tokens.v1.css\"", result, StringComparison.Ordinal);
        Assert.Contains($"href=\"{activePath}\" aria-current=\"page\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/\">Dashboard</a>", result, StringComparison.Ordinal);
        Assert.Contains($"window.{compatibilityName}", result, StringComparison.Ordinal);
        Assert.Contains(userContent, result, StringComparison.Ordinal);
        Assert.DoesNotContain("MutationObserver", result, StringComparison.Ordinal);
        Assert.DoesNotContain("replaceAll", result, StringComparison.Ordinal);
        Assert.Equal(
            domain == EngineDomain.Movie,
            result.Contains("Library Import requires one folder per movie", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(EngineDomain.Movie, "movies", "television")]
    [InlineData(EngineDomain.Television, "television", "movies")]
    public void AddsOnlyTheRequestedEngineContext(EngineDomain domain, string expected, string unexpected)
    {
        var result = NativeShellBranding.Transform("<html><head><title>App</title></head><body><div id=\"root\"></div></body></html>", domain);

        Assert.Contains($"data-vy-engine=\"{expected}\"", result, StringComparison.Ordinal);
        Assert.Contains($"vy-engine-{expected}", result, StringComparison.Ordinal);
        Assert.DoesNotContain($"vy-engine-{unexpected}", result, StringComparison.Ordinal);
    }

    [Fact]
    public void FeatureFlagsRestoreLegacyShellAndOmitTokens()
    {
        var result = NativeShellBranding.Transform(
            "<html><head><title>Radarr</title></head><body><div id=\"root\"></div></body></html>",
            EngineDomain.Movie,
            new UiOptions { TokensEnabled = false, NewShellStylingEnabled = false });

        Assert.DoesNotContain("vynodearr-tokens.v1.css", result, StringComparison.Ordinal);
        Assert.Contains("class=\"vynodearr-link\"", result, StringComparison.Ordinal);
        Assert.DoesNotContain("class=\"vy-engine-badge\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/movies/\" aria-current=\"page\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/television/\"", result, StringComparison.Ordinal);
    }
}
