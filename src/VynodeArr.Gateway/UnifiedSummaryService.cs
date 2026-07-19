using System.Net.Http.Headers;
using System.Text.Json;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway;

public sealed record UnifiedSummary(
    DateTimeOffset Timestamp,
    IReadOnlyDictionary<string, DomainSummary> Domains);

public sealed record DomainSummary(
    string Domain,
    string State,
    string? Application,
    string? Version,
    int LibraryItems,
    int MonitoredItems,
    int DownloadedFiles,
    int MissingMonitored,
    int QueueItems,
    int HealthIssues,
    string? Error);

public sealed class UnifiedSummaryService(
    HttpClient client,
    EngineRegistry registry,
    TimeProvider timeProvider)
{
    public async Task<UnifiedSummary> GetAsync(CancellationToken cancellationToken)
    {
        var tasks = Enum.GetValues<EngineDomain>()
            .Select(domain => GetDomainAsync(domain, cancellationToken));
        var domains = await Task.WhenAll(tasks);

        return new UnifiedSummary(
            timeProvider.GetUtcNow(),
            domains.ToDictionary(item => item.Domain, StringComparer.Ordinal));
    }

    private async Task<DomainSummary> GetDomainAsync(
        EngineDomain domain,
        CancellationToken cancellationToken)
    {
        var engine = registry.Get(domain);
        var apiKey = registry.GetApiKey(domain);
        if (engine.State != EngineState.Running || engine.Port is null || string.IsNullOrWhiteSpace(apiKey))
        {
            return Empty(domain, engine.State.ToString(), "Engine is not available.");
        }

        try
        {
            var baseUri = new Uri(
                $"http://127.0.0.1:{engine.Port}{domain.NativePathBase()}/api/v3/",
                UriKind.Absolute);
            var libraryPath = domain == EngineDomain.Movie ? "movie" : "series";
            var statusTask = GetJsonAsync(baseUri, "system/status", apiKey, cancellationToken);
            var libraryTask = GetJsonAsync(baseUri, libraryPath, apiKey, cancellationToken);
            var missingTask = GetJsonAsync(baseUri, "wanted/missing?page=1&pageSize=1", apiKey, cancellationToken);
            var queueTask = GetJsonAsync(baseUri, "queue?page=1&pageSize=1", apiKey, cancellationToken);
            var healthTask = GetJsonAsync(baseUri, "health", apiKey, cancellationToken);
            await Task.WhenAll(statusTask, libraryTask, missingTask, queueTask, healthTask);

            using var status = await statusTask;
            using var library = await libraryTask;
            using var missing = await missingTask;
            using var queue = await queueTask;
            using var health = await healthTask;
            var items = library.RootElement.EnumerateArray().ToArray();

            return new DomainSummary(
                domain.Key(),
                EngineState.Running.ToString(),
                ReadString(status.RootElement, "appName"),
                ReadString(status.RootElement, "version"),
                items.Length,
                items.Count(item => ReadBoolean(item, "monitored")),
                domain == EngineDomain.Movie
                    ? items.Count(item => ReadBoolean(item, "hasFile"))
                    : items.Sum(item => ReadNestedInt(item, "statistics", "episodeFileCount")),
                ReadInt(missing.RootElement, "totalRecords"),
                ReadInt(queue.RootElement, "totalRecords"),
                health.RootElement.ValueKind == JsonValueKind.Array
                    ? health.RootElement.GetArrayLength()
                    : 0,
                null);
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException or TaskCanceledException)
        {
            return Empty(domain, EngineState.Degraded.ToString(), exception.Message);
        }
    }

    private async Task<JsonDocument> GetJsonAsync(
        Uri baseUri,
        string relativePath,
        string apiKey,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(baseUri, relativePath));
        request.Headers.Add("X-Api-Key", apiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        using var response = await client.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var content = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonDocument.ParseAsync(content, cancellationToken: cancellationToken);
    }

    private static DomainSummary Empty(EngineDomain domain, string state, string error) =>
        new(domain.Key(), state, null, null, 0, 0, 0, 0, 0, 0, error);

    private static string? ReadString(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) ? value.GetString() : null;

    private static int ReadInt(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.TryGetInt32(out var result) ? result : 0;

    private static int ReadNestedInt(JsonElement element, string parent, string name) =>
        element.TryGetProperty(parent, out var nested) ? ReadInt(nested, name) : 0;

    private static bool ReadBoolean(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;
}
