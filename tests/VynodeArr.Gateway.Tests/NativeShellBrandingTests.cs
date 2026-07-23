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
        var html = $"<html lang=\"en\"><head><meta name=\"description\" content=\"{compatibilityName}\"><link rel=\"icon\" href=\"/{compatibilityName}/favicon.png\"><link rel=\"shortcut icon\" href=\"/{compatibilityName}/favicon.ico\"><link rel=\"apple-touch-icon\" href=\"/{compatibilityName}/apple.png\"><title>{compatibilityName}</title></head><body><script>window.{compatibilityName}={{}};</script><div id=\"root\">{userContent}</div></body></html>";

        var result = NativeShellBranding.Transform(html, domain, new UiOptions());

        Assert.Contains($"<title>{productName}</title>", result, StringComparison.Ordinal);
        Assert.Contains($"data-vy-engine=\"{(domain == EngineDomain.Movie ? "movies" : "television")}\"", result, StringComparison.Ordinal);
        Assert.Contains("aria-label=\"VynodeArr sections\"", result, StringComparison.Ordinal);
        Assert.Contains($"aria-label=\"Current engine: {productName}\"", result, StringComparison.Ordinal);
        Assert.Contains("src=\"/assets/vynodearr.png\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/assets/vynodearr-tokens.v1.css?rev=2\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/assets/vynodearr-native.v2.css?rev=6\"", result, StringComparison.Ordinal);
        Assert.Contains($"href=\"{activePath}\" aria-current=\"page\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/\">Dashboard</a>", result, StringComparison.Ordinal);
        Assert.Contains($"window.{compatibilityName}", result, StringComparison.Ordinal);
        Assert.Contains(userContent, result, StringComparison.Ordinal);
        Assert.Contains("id=\"vynodearr-favicon\"", result, StringComparison.Ordinal);
        Assert.Contains("id=\"vynodearr-shortcut-icon\"", result, StringComparison.Ordinal);
        Assert.Contains("id=\"vynodearr-apple-icon\"", result, StringComparison.Ordinal);
        Assert.DoesNotContain($"href=\"/{compatibilityName}/favicon", result, StringComparison.Ordinal);
        Assert.DoesNotContain($"href=\"/{compatibilityName}/apple", result, StringComparison.Ordinal);
        Assert.Contains("id=\"vynodearr-native-presentation\"", result, StringComparison.Ordinal);
        Assert.Contains("replaceProductName", result, StringComparison.Ordinal);
        Assert.Contains("a[href$=\"/system/updates\"]", result, StringComparison.Ordinal);
        Assert.Contains("observe(document.documentElement", result, StringComparison.Ordinal);
        Assert.Contains("hiddenLegends.add('style')", result, StringComparison.Ordinal);
        Assert.Contains("hiddenLegends.add('security')", result, StringComparison.Ordinal);
        Assert.Contains("hiddenLegends.add('updates')", result, StringComparison.Ordinal);
        Assert.Contains("hiddenLegends.add('more info')", result, StringComparison.Ordinal);
        Assert.Contains("hiddenLegends.add('donations')", result, StringComparison.Ordinal);
        Assert.Contains("versionValue.textContent = productVersion", result, StringComparison.Ordinal);
        Assert.DoesNotContain("vynodearr-import-notice", result, StringComparison.Ordinal);
        Assert.DoesNotContain("Library Import requires one folder per movie", result, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("Radarr", "VynodeArr Movies")]
    [InlineData("Sonarr", "VynodeArr Television")]
    [InlineData(
        "Radarr and Sonarr are unavailable",
        "VynodeArr Movies and VynodeArr Television are unavailable")]
    public void RebrandsCompatibilityProductNamesForPresentation(string value, string expected)
    {
        Assert.Equal(expected, NativeShellBranding.PresentText(value));
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
        Assert.DoesNotContain("vynodearr-native.v2.css", result, StringComparison.Ordinal);
        Assert.Contains("class=\"vynodearr-link\"", result, StringComparison.Ordinal);
        Assert.DoesNotContain("class=\"vy-engine-badge\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/movies/\" aria-current=\"page\"", result, StringComparison.Ordinal);
        Assert.Contains("href=\"/television/\"", result, StringComparison.Ordinal);
    }

    [Fact]
    public void PreservesNativeFormsLinksAndControlsByteForByte()
    {
        const string nativeMarkup = "<form action=\"/movies/settings\" method=\"post\"><label for=\"path\">Path</label><input id=\"path\" name=\"path\" value=\"D:\\\\Movies\"><a href=\"/movies/wanted\">Wanted</a><button type=\"submit\" data-command=\"save\">Save</button></form>";
        var html = $"<html><head><title>Radarr</title></head><body><div id=\"root\">{nativeMarkup}</div></body></html>";

        var result = NativeShellBranding.Transform(html, EngineDomain.Movie, new UiOptions());

        Assert.Contains(nativeMarkup, result, StringComparison.Ordinal);
        Assert.Equal(1, CountOccurrences(result, nativeMarkup));
    }

    private static int CountOccurrences(string value, string search)
    {
        var count = 0;
        var index = 0;
        while ((index = value.IndexOf(search, index, StringComparison.Ordinal)) >= 0)
        {
            count++;
            index += search.Length;
        }

        return count;
    }
}
