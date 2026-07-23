namespace VynodeArr.Gateway.Tests;

public sealed class DockerDistributionTests
{
    [Fact]
    public void ContainerLoadsGatewayConfigurationAndPassesIsolatedDataArguments()
    {
        var repositoryRoot = FindRepositoryRoot();
        var dockerfile = File.ReadAllText(
            Path.Combine(repositoryRoot, "distribution", "docker", "Dockerfile"));

        Assert.Contains("WORKDIR /opt/vynodearr/gateway", dockerfile, StringComparison.Ordinal);
        Assert.Contains(
            "VynodeArr__Engines__Movie__Arguments=\"-nobrowser -data={data}\"",
            dockerfile,
            StringComparison.Ordinal);
        Assert.Contains(
            "VynodeArr__Engines__Television__Arguments=\"-nobrowser -data={data}\"",
            dockerfile,
            StringComparison.Ordinal);
        Assert.Contains("/opt/vynodearr/engines/movie/ffprobe", dockerfile, StringComparison.Ordinal);
        Assert.Contains("/opt/vynodearr/engines/television/ffprobe", dockerfile, StringComparison.Ordinal);
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
