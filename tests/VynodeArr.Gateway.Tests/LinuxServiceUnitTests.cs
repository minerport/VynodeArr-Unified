namespace VynodeArr.Gateway.Tests;

public sealed class LinuxServiceUnitTests
{
    [Fact]
    public void ServiceSandboxDoesNotRestrictUserSelectedMediaPaths()
    {
        var repositoryRoot = FindRepositoryRoot();
        var unit = File.ReadAllText(
            Path.Combine(repositoryRoot, "distribution", "linux", "vynodearr.service"));

        Assert.Contains("User=vynodearr", unit, StringComparison.Ordinal);
        Assert.Contains("NoNewPrivileges=true", unit, StringComparison.Ordinal);
        Assert.Contains("ProtectSystem=full", unit, StringComparison.Ordinal);
        Assert.Contains("ProtectHome=false", unit, StringComparison.Ordinal);
        Assert.DoesNotContain("ProtectSystem=strict", unit, StringComparison.Ordinal);
        Assert.DoesNotContain("ReadWritePaths=", unit, StringComparison.Ordinal);
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
