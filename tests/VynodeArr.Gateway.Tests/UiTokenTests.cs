namespace VynodeArr.Gateway.Tests;

public sealed class UiTokenTests
{
    private static string LoadTokens()
    {
        var root = FindRepositoryRoot();
        return File.ReadAllText(Path.Combine(root, "src", "VynodeArr.Gateway", "Assets", "VynodeArrTokens.v1.css"));
    }

    [Fact]
    public void DefinesRequiredDarkLightContextFocusDensityAndMotionTokens()
    {
        var css = LoadTokens();
        var required = new[]
        {
            "--vy-surface-app", "--vy-surface-panel", "--vy-text-primary",
            "--vy-border-subtle", "--vy-engine-movies", "--vy-engine-television",
            "--vy-engine-shared", "--vy-status-success", "--vy-status-error",
            "--vy-space-1", "--vy-radius-md", "--vy-font-sans", "--vy-font-mono",
            "--vy-motion-fast", "--vy-focus-ring", "--vy-target-desktop",
            "--vy-target-touch", "--vy-table-row-compact", "--vy-shell-height"
        };

        foreach (var token in required)
        {
            Assert.Contains(token, css, StringComparison.Ordinal);
        }

        Assert.Contains("prefers-color-scheme: light", css, StringComparison.Ordinal);
        Assert.Contains("data-vy-theme=\"light\"", css, StringComparison.Ordinal);
        Assert.Contains("prefers-reduced-motion: reduce", css, StringComparison.Ordinal);
        Assert.Contains("forced-colors: active", css, StringComparison.Ordinal);
        Assert.Contains("data-vy-engine=\"movies\"", css, StringComparison.Ordinal);
        Assert.Contains("data-vy-engine=\"television\"", css, StringComparison.Ordinal);
        Assert.Contains("--vy-engine-television: #34d399", css, StringComparison.Ordinal);
    }

    [Fact]
    public void DoesNotContainCredentialNamesOrSecrets()
    {
        var css = LoadTokens();

        Assert.DoesNotContain("ApiKey", css, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("LifecycleApiKey", css, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", css, StringComparison.OrdinalIgnoreCase);
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
