using System.Xml.Linq;

namespace VynodeArr.Gateway.Runtime;

public interface IEngineApiKeyProvider
{
    Task PrepareAsync(string dataDirectory, CancellationToken cancellationToken);

    Task<string> ReadAsync(string dataDirectory, TimeSpan timeout, CancellationToken cancellationToken);
}

public sealed class XmlEngineApiKeyProvider : IEngineApiKeyProvider
{
    public async Task PrepareAsync(string dataDirectory, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(dataDirectory);
        var configPath = Path.Combine(dataDirectory, "config.xml");
        XDocument document;

        if (File.Exists(configPath))
        {
            await using var readStream = new FileStream(
                configPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 4096,
                useAsync: true);
            document = await XDocument.LoadAsync(readStream, LoadOptions.None, cancellationToken);
        }
        else
        {
            document = new XDocument(new XElement("Config"));
        }

        var root = document.Root ?? throw new InvalidDataException($"Engine configuration {configPath} has no root element.");
        var changed = EnsureValue(root, "ApiKey", Guid.NewGuid().ToString("N"), replaceExisting: false);
        changed |= EnsureValue(root, "AuthenticationMethod", "External", replaceExisting: true);
        changed |= EnsureValue(root, "AuthenticationRequired", "DisabledForLocalAddresses", replaceExisting: true);

        if (!changed && File.Exists(configPath))
        {
            return;
        }

        var temporaryPath = $"{configPath}.{Guid.NewGuid():N}.tmp";
        try
        {
            await using (var writeStream = new FileStream(
                temporaryPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 4096,
                useAsync: true))
            {
                await document.SaveAsync(writeStream, SaveOptions.None, cancellationToken);
            }

            File.Move(temporaryPath, configPath, overwrite: true);
        }
        finally
        {
            File.Delete(temporaryPath);
        }
    }

    public async Task<string> ReadAsync(
        string dataDirectory,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        var configPath = Path.Combine(dataDirectory, "config.xml");

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

    private static bool EnsureValue(
        XElement root,
        string name,
        string fallbackValue,
        bool replaceExisting)
    {
        var elements = root.Elements(name).ToList();
        var first = elements.FirstOrDefault();
        var value = replaceExisting || string.IsNullOrWhiteSpace(first?.Value)
            ? fallbackValue
            : first!.Value;
        var changed = first is null || first.Value != value || elements.Count > 1;

        if (first is null)
        {
            root.Add(new XElement(name, value));
        }
        else
        {
            first.Value = value;
            foreach (var duplicate in elements.Skip(1))
            {
                duplicate.Remove();
            }
        }

        return changed;
    }
}
