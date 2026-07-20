using System.Net.Http.Headers;
using System.Text.Json;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Dashboard;

public abstract class DashboardClientBase(HttpClient client, EngineRegistry registry, EngineDomain domain)
{
    protected async Task<JsonDocument> GetAsync(string path, CancellationToken cancellationToken)
    {
        var state = registry.Get(domain);
        var apiKey = registry.GetApiKey(domain);
        if (state.State != EngineState.Running || state.Port is null || string.IsNullOrWhiteSpace(apiKey)) throw new HttpRequestException("Engine unavailable.");
        var version = domain == EngineDomain.Movie ? "v3" : "v5";
        using var request = new HttpRequestMessage(HttpMethod.Get, $"http://127.0.0.1:{state.Port}{domain.NativePathBase()}/api/{version}/{path}");
        request.Headers.Add("X-Api-Key", apiKey); request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
    }
    protected static int Int(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.TryGetInt32(out var r) ? r : 0;
    protected static long? Long(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.TryGetInt64(out var r) ? r : null;
    protected static string? String(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    protected static string? NestedString(JsonElement e, string parent, string name) => e.TryGetProperty(parent, out var p) && p.ValueKind == JsonValueKind.Object ? String(p, name) : null;
    protected static DashboardModule<IReadOnlyList<DashboardQueueItem>> Unavailable(MediaEngine engine) => new(false, null, new("ENGINE_UNAVAILABLE", $"The {engine} Engine could not be reached."));
}

public sealed class MoviesDashboardClient(HttpClient client, EngineRegistry registry) : DashboardClientBase(client, registry, EngineDomain.Movie), IMoviesDashboardClient
{
    public async Task<DashboardModule<IReadOnlyList<DashboardQueueItem>>> GetQueueAsync(int limit, CancellationToken cancellationToken)
    {
        try { using var json = await GetAsync($"queue?page=1&pageSize={Math.Clamp(limit, 1, 50)}&includeMovie=true", cancellationToken); return new(true, Map(json.RootElement).ToArray(), null); }
        catch (Exception e) when (e is HttpRequestException or JsonException or TaskCanceledException) { return Unavailable(MediaEngine.Movies); }
    }
    private static IEnumerable<DashboardQueueItem> Map(JsonElement root)
    {
        if (!root.TryGetProperty("records", out var records)) yield break;
        foreach (var item in records.EnumerateArray())
        {
            var id = Int(item, "id"); var size = Long(item, "size"); var left = Long(item, "sizeleft"); var status = String(item, "status") ?? "unknown";
            yield return new($"movies:{id}", MediaEngine.Movies, id, String(item, "title") ?? NestedString(item, "movie", "title") ?? "Movie", null, "Movie", status, Progress(size, left), size, left, String(item, "timeleft"), NestedString(item, "quality", "quality"), String(item, "downloadClient"), IsWarning(status), String(item, "errorMessage"), "/movies/activity/queue");
        }
    }
    private static double? Progress(long? size, long? left) => size > 0 && left is not null ? Math.Round(100d * (size.Value - left.Value) / size.Value, 1) : null;
    private static bool IsWarning(string status) => status.Contains("fail", StringComparison.OrdinalIgnoreCase) || status.Contains("warn", StringComparison.OrdinalIgnoreCase);
}

public sealed class TelevisionDashboardClient(HttpClient client, EngineRegistry registry) : DashboardClientBase(client, registry, EngineDomain.Television), ITelevisionDashboardClient
{
    public async Task<DashboardModule<IReadOnlyList<DashboardQueueItem>>> GetQueueAsync(int limit, CancellationToken cancellationToken)
    {
        try { using var json = await GetAsync($"queue?page=1&pageSize={Math.Clamp(limit, 1, 50)}&includeSeries=true&includeEpisode=true", cancellationToken); return new(true, Map(json.RootElement).ToArray(), null); }
        catch (Exception e) when (e is HttpRequestException or JsonException or TaskCanceledException) { return Unavailable(MediaEngine.Television); }
    }
    private static IEnumerable<DashboardQueueItem> Map(JsonElement root)
    {
        if (!root.TryGetProperty("records", out var records)) yield break;
        foreach (var item in records.EnumerateArray())
        {
            var id = Int(item, "id"); var size = Long(item, "size"); var left = Long(item, "sizeleft"); var status = String(item, "status") ?? "unknown";
            var series = NestedString(item, "series", "title"); var episode = NestedString(item, "episode", "title");
            yield return new($"television:{id}", MediaEngine.Television, id, series ?? String(item, "title") ?? "Episode", episode, "Episode", status, Progress(size, left), size, left, String(item, "timeleft"), NestedString(item, "quality", "quality"), String(item, "downloadClient"), IsWarning(status), String(item, "errorMessage"), "/television/activity/queue");
        }
    }
    private static double? Progress(long? size, long? left) => size > 0 && left is not null ? Math.Round(100d * (size.Value - left.Value) / size.Value, 1) : null;
    private static bool IsWarning(string status) => status.Contains("fail", StringComparison.OrdinalIgnoreCase) || status.Contains("warn", StringComparison.OrdinalIgnoreCase);
}

public sealed class DashboardQueueService(IMoviesDashboardClient movies, ITelevisionDashboardClient television, TimeProvider timeProvider)
{
    public async Task<DashboardEnvelope<IReadOnlyList<DashboardQueueItem>>> GetAsync(int limit, CancellationToken cancellationToken)
    {
        var movieTask = movies.GetQueueAsync(limit, cancellationToken); var tvTask = television.GetQueueAsync(limit, cancellationToken);
        await Task.WhenAll(movieTask, tvTask);
        return new(timeProvider.GetUtcNow(), await movieTask, await tvTask);
    }
}
