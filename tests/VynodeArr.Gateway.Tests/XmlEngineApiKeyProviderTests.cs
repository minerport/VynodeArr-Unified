using System.Xml.Linq;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class XmlEngineApiKeyProviderTests
{
    [Fact]
    public async Task ReadAsyncCreatesAFirstRunConfigWithAnApiKey()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"vynodearr-api-key-{Guid.NewGuid():N}");
        try
        {
            var provider = new XmlEngineApiKeyProvider();
            await provider.PrepareAsync(directory, CancellationToken.None);

            var apiKey = await provider.ReadAsync(directory, TimeSpan.FromSeconds(1), CancellationToken.None);

            Assert.Equal(32, apiKey.Length);
            var document = XDocument.Load(Path.Combine(directory, "config.xml"));
            Assert.Equal(apiKey, document.Root?.Element("ApiKey")?.Value);
            Assert.Equal("External", document.Root?.Element("AuthenticationMethod")?.Value);
            Assert.Equal("DisabledForLocalAddresses", document.Root?.Element("AuthenticationRequired")?.Value);
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
    }

    [Fact]
    public async Task ReadAsyncPreservesAnExistingApiKey()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"vynodearr-api-key-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        const string expected = "existing-engine-api-key";
        await File.WriteAllTextAsync(
            Path.Combine(directory, "config.xml"),
            $"<Config><ApiKey>{expected}</ApiKey><Port>7878</Port></Config>");

        try
        {
            var provider = new XmlEngineApiKeyProvider();
            await provider.PrepareAsync(directory, CancellationToken.None);

            var apiKey = await provider.ReadAsync(directory, TimeSpan.FromSeconds(1), CancellationToken.None);

            Assert.Equal(expected, apiKey);
            Assert.Contains("<Port>7878</Port>", await File.ReadAllTextAsync(Path.Combine(directory, "config.xml")));
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    [Fact]
    public async Task PrepareAsyncReconcilesAuthenticationAndPreservesCredentials()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"vynodearr-api-key-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        await File.WriteAllTextAsync(
            Path.Combine(directory, "config.xml"),
            "<Config><ApiKey>existing</ApiKey><AuthenticationMethod>Forms</AuthenticationMethod>" +
            "<AuthenticationMethod>Basic</AuthenticationMethod><AuthenticationRequired>Enabled</AuthenticationRequired>" +
            "<Username>engine-user</Username><Password>engine-password</Password></Config>");

        try
        {
            var provider = new XmlEngineApiKeyProvider();

            await provider.PrepareAsync(directory, CancellationToken.None);
            await provider.PrepareAsync(directory, CancellationToken.None);

            var document = XDocument.Load(Path.Combine(directory, "config.xml"));
            Assert.Equal("existing", document.Root?.Element("ApiKey")?.Value);
            Assert.Single(document.Root!.Elements("AuthenticationMethod"));
            Assert.Equal("External", document.Root.Element("AuthenticationMethod")?.Value);
            Assert.Equal("DisabledForLocalAddresses", document.Root.Element("AuthenticationRequired")?.Value);
            Assert.Equal("engine-user", document.Root.Element("Username")?.Value);
            Assert.Equal("engine-password", document.Root.Element("Password")?.Value);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }
}
