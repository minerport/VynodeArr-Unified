using VynodeArr.Gateway;
using VynodeArr.Gateway.Configuration;

namespace VynodeArr.Gateway.Tests;

public sealed class UnifiedShellTests
{
    [Fact]
    public void EmbedsBrandingAndContinuousEngineStatusRefresh()
    {
        var html = UnifiedShell.Render(new UiOptions(), "1.2.3");

        Assert.Contains("data-vy-engine=\"shared\"", html, StringComparison.Ordinal);
        Assert.Contains("src=\"/assets/vynodearr.png\"", html, StringComparison.Ordinal);
        Assert.Contains("href=\"/assets/vynodearr-tokens.v1.css\"", html, StringComparison.Ordinal);
        Assert.Contains("Version 1.2.3", html, StringComparison.Ordinal);
        Assert.Contains("setTimeout(loadSummary, delay)", html, StringComparison.Ordinal);
        Assert.Contains("cache: 'no-store'", html, StringComparison.Ordinal);
        Assert.Contains("Starting' : 'Stopping", html, StringComparison.Ordinal);
        Assert.Contains("Shut down VynodeArr", html, StringComparison.Ordinal);
        Assert.Contains("aria-live=\"polite\"", html, StringComparison.Ordinal);
        Assert.Contains("label: 'Running'", html, StringComparison.Ordinal);
        Assert.Contains("Last 30 days", html, StringComparison.Ordinal);
        Assert.Contains("/api/unified/v1/calendar", html, StringComparison.Ordinal);
        Assert.Contains("data-status=", html, StringComparison.Ordinal);
        Assert.Contains("setTimeout(loadCalendar, 300000)", html, StringComparison.Ordinal);
        Assert.DoesNotContain("X-Api-Key", html, StringComparison.Ordinal);
    }

    [Fact]
    public void OmitsTokenStylesheetWhenTokenFlagIsDisabled()
    {
        var html = UnifiedShell.Render(new UiOptions { TokensEnabled = false });

        Assert.DoesNotContain("vynodearr-tokens.v1.css", html, StringComparison.Ordinal);
        Assert.Contains("href=\"/movies/\"", html, StringComparison.Ordinal);
        Assert.Contains("href=\"/television/\"", html, StringComparison.Ordinal);
        Assert.Contains("id=\"shutdown-all\"", html, StringComparison.Ordinal);
        Assert.DoesNotContain("Quick navigation", html, StringComparison.Ordinal);
        Assert.Contains("'/movies/system/status'", html, StringComparison.Ordinal);
        Assert.Contains("'/television/system/status'", html, StringComparison.Ordinal);
    }

    [Fact]
    public void LegacyStylingFlagKeepsDashboardRoutesAndLifecycleActions()
    {
        var html = UnifiedShell.Render(new UiOptions { NewShellStylingEnabled = false });

        Assert.Contains("vy-foundation-disabled", html, StringComparison.Ordinal);
        Assert.Contains("/api/unified/v1/engines/", html, StringComparison.Ordinal);
        Assert.Contains("/api/unified/v1/shutdown", html, StringComparison.Ordinal);
        Assert.DoesNotContain("Quick navigation", html, StringComparison.Ordinal);
        Assert.Contains("'/movies/system/status'", html, StringComparison.Ordinal);
        Assert.Contains("'/television/system/status'", html, StringComparison.Ordinal);
    }
}
