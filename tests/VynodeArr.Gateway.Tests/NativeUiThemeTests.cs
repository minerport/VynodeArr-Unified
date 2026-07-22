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
        Assert.Contains("PageSidebarItem/isActiveLink/", css, StringComparison.Ordinal);
        Assert.Contains("PageToolbar/toolbar/", css, StringComparison.Ordinal);
        Assert.Contains("Card/card/", css, StringComparison.Ordinal);
        Assert.Contains("Table/table/", css, StringComparison.Ordinal);
        Assert.Contains("Modal/modal/", css, StringComparison.Ordinal);
        Assert.Contains("MenuContent/menuContent/", css, StringComparison.Ordinal);
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
