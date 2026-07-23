namespace VynodeArr.Gateway.Tests;

public sealed class NativeUiThemeTests
{
    private static string LoadTheme()
    {
        var root = FindRepositoryRoot();
        return File.ReadAllText(Path.Combine(root, "src", "VynodeArr.Gateway", "Assets", "VynodeArrNative.v1.css"));
    }

    [Fact]
    public void StylesSharedNativeSurfacesWithoutHidingFunctionality()
    {
        var css = LoadTheme();

        Assert.Contains("html[data-vy-engine]", css, StringComparison.Ordinal);
        Assert.Contains("PageSidebarItem-isActiveLink-", css, StringComparison.Ordinal);
        Assert.Contains("PageToolbar-toolbar-", css, StringComparison.Ordinal);
        Assert.Contains("Card-card-", css, StringComparison.Ordinal);
        Assert.Contains("Table-table-", css, StringComparison.Ordinal);
        Assert.Contains("Modal-modal-", css, StringComparison.Ordinal);
        Assert.Contains("MenuContent-menuContent-", css, StringComparison.Ordinal);
        Assert.Contains("PageHeader-logoContainer-", css, StringComparison.Ordinal);
        Assert.Contains("flex: 0 0 0", css, StringComparison.Ordinal);
        Assert.Contains("MovieSearchInput-wrapper-", css, StringComparison.Ordinal);
        Assert.Contains("SeriesSearchInput-wrapper-", css, StringComparison.Ordinal);
        Assert.Contains("StatisticsSummary-item-", css, StringComparison.Ordinal);
        Assert.Contains("PageSidebarItem-isActiveItem-", css, StringComparison.Ordinal);
        Assert.Contains("border-left-color: transparent", css, StringComparison.Ordinal);
        Assert.Contains("FieldSet-legend-", css, StringComparison.Ordinal);
        Assert.Contains("MovieIndexPoster-content-", css, StringComparison.Ordinal);
        Assert.Contains("SeriesIndexPoster-content-", css, StringComparison.Ordinal);
        Assert.Contains("MovieIndexOverview-content-", css, StringComparison.Ordinal);
        Assert.Contains("SeriesIndexOverview-content-", css, StringComparison.Ordinal);
        Assert.Contains("MovieIndexRow-cell-", css, StringComparison.Ordinal);
        Assert.Contains("SeriesIndexRow-cell-", css, StringComparison.Ordinal);
        Assert.Contains("@media (hover: none), (pointer: coarse)", css, StringComparison.Ordinal);
        Assert.Contains(":focus-within", css, StringComparison.Ordinal);
        Assert.Contains("img[src^=\"data:image/\"]", css, StringComparison.Ordinal);
        Assert.Contains("content: url(\"/assets/vynodearr.png\")", css, StringComparison.Ordinal);
        Assert.Contains("flex: 1 1 720px", css, StringComparison.Ordinal);
        Assert.Contains("max-width: 920px", css, StringComparison.Ordinal);
        Assert.Contains("max-height: 28px", css, StringComparison.Ordinal);
        Assert.Contains("MovieDetails-backdrop-", css, StringComparison.Ordinal);
        Assert.Contains("SeriesDetails-backdrop-", css, StringComparison.Ordinal);
        Assert.Contains("MovieDetails-headerContent-", css, StringComparison.Ordinal);
        Assert.Contains("SeriesDetails-headerContent-", css, StringComparison.Ordinal);
        Assert.Contains("isolation: isolate", css, StringComparison.Ordinal);
        Assert.Contains("background-position: center 22%", css, StringComparison.Ordinal);
        Assert.Contains("backdrop-filter: blur(8px)", css, StringComparison.Ordinal);
        Assert.Contains(":focus-visible", css, StringComparison.Ordinal);
        Assert.Contains("forced-colors: active", css, StringComparison.Ordinal);
        Assert.DoesNotContain("display: none", css, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("visibility: hidden", css, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("pointer-events: none", css, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ContainsNoCredentialsScriptsOrEngineRoutes()
    {
        var css = LoadTheme();

        Assert.DoesNotContain("ApiKey", css, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", css, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("javascript:", css, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("/movies/", css, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("/television/", css, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void AllowsRemoteHttpsArtworkWithoutAllowingRemoteScriptsOrApiConnections()
    {
        var root = FindRepositoryRoot();
        var program = File.ReadAllText(Path.Combine(root, "src", "VynodeArr.Gateway", "Program.cs"));

        Assert.Contains("img-src 'self' data: https:", program, StringComparison.Ordinal);
        Assert.Contains("script-src 'self' 'unsafe-inline'", program, StringComparison.Ordinal);
        Assert.Contains("connect-src 'self' ws: wss:", program, StringComparison.Ordinal);
        Assert.DoesNotContain("script-src 'self' https:", program, StringComparison.Ordinal);
        Assert.DoesNotContain("connect-src 'self' https:", program, StringComparison.Ordinal);
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "VynodeArr.Unified.sln")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the VynodeArr repository root.");
    }
}
