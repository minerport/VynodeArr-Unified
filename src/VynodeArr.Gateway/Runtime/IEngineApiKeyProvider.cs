using System.Xml.Linq;

namespace VynodeArr.Gateway.Runtime;

public interface IEngineApiKeyProvider
{
    Task<string> ReadAsync(string dataDirectory, TimeSpan timeout, CancellationToken cancellationToken);
}

public sealed class XmlEngineApiKeyProvider : IEngineApiKeyProvider
{
    public async Task<string> ReadAsync(
        string dataDirectory,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(dataDirectory);
        var configPath = Path.Combine(dataDirectory, "config.xml");
        if (!File.Exists(configPath))
        {
            var initialDocument = new XDocument(
                new XElement("Config", new XElement("ApiKey", Guid.NewGuid().ToString("N"))));
            try
            {
                await using var initialStream = new FileStream(
                    configPath,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.Read,
                    bufferSize: 4096,
                    useAsync: true);
                await initialDocument.SaveAsync(initialStream, SaveOptions.None, cancellationToken);
            }
            catch (IOException) when (File.Exists(configPath))
            {
                // Another startup path created the file between the existence check and CreateNew.
            }
        }

        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutSource.CancelAfter(timeout);
        Exception? lastError = null;

        while (!timeoutSource.IsCancellationRequested)
        {
            try
            {
                if (File.Exists(configPath))
                {
                    await using var stream = new FileStream(
                        configPath,
                        FileMode.Open,
                        FileAccess.Read,
                        FileShare.ReadWrite | FileShare.Delete,
                        bufferSize: 4096,
                        useAsync: true);
                    var document = await XDocument.LoadAsync(stream, LoadOptions.None, timeoutSource.Token);
                    var apiKey = document.Root?.Element("ApiKey")?.Value;
                    if (!string.IsNullOrWhiteSpace(apiKey))
                    {
                        return apiKey;
                    }
                }
            }
            catch (IOException exception)
            {
                lastError = exception;
            }
            catch (System.Xml.XmlException exception)
            {
                lastError = exception;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(100), timeoutSource.Token)
                .ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
        }

        cancellationToken.ThrowIfCancellationRequested();
        throw new TimeoutException($"An engine API key was not available in {configPath}.", lastError);
    }
}
