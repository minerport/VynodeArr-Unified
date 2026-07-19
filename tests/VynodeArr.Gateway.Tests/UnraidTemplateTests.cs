using System.Xml.Linq;

namespace VynodeArr.Gateway.Tests;

public sealed class UnraidTemplateTests
{
    [Fact]
    public void TemplateKeepsVynodeArrIsolatedFromExistingMediaManagers()
    {
        var repositoryRoot = FindRepositoryRoot();
        var document = XDocument.Load(
            Path.Combine(repositoryRoot, "distribution", "unraid", "vynodearr.xml"));
        var root = Assert.IsType<XElement>(document.Root);
        var repository = root.Element("Repository")?.Value;
        var configs = root.Elements("Config").ToArray();

        Assert.Equal("ghcr.io/minerport/vynodearr-unified:0.4.3", repository);
        Assert.Equal("bridge", root.Element("Network")?.Value);
        Assert.Contains("--user 99:100", root.Element("ExtraParams")?.Value, StringComparison.Ordinal);
        Assert.Contains(configs, config => Attribute(config, "Target") == "8686");
        Assert.Contains(configs, config =>
            Attribute(config, "Target") == "/config" &&
            string.Equals(config.Value, "/mnt/user/appdata/vynodearr", StringComparison.Ordinal));
        Assert.Contains(configs, config => Attribute(config, "Target") == "/movies");
        Assert.Contains(configs, config => Attribute(config, "Target") == "/tv");
        Assert.Contains(configs, config => Attribute(config, "Target") == "/downloads");
        Assert.DoesNotContain(
            configs,
            config => Attribute(config, "Target") == "/config" &&
                (config.Value.Contains("radarr", StringComparison.OrdinalIgnoreCase) ||
                 config.Value.Contains("sonarr", StringComparison.OrdinalIgnoreCase)));
    }

    private static string? Attribute(XElement element, string name) => element.Attribute(name)?.Value;

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
