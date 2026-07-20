using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway;

public sealed record UnifiedCalendar(
    DateTimeOffset Start,
    DateTimeOffset End,
    IReadOnlyDictionary<string, CalendarDomain> Domains);

public sealed record CalendarDomain(
    string Domain,
    IReadOnlyList<CalendarItem> Items,
    string? Error);

public sealed record CalendarItem(
    int Id,
    string Title,
    string? Subtitle,
    DateTimeOffset Date,
    string Status,
    string StatusKey,
    string Link);

public sealed class UnifiedCalendarService(
    HttpClient client,
    EngineRegistry registry,
    TimeProvider timeProvider)
{
    private const int CalendarDays = 30;

    public async Task<UnifiedCalendar> GetAsync(CancellationToken cancellationToken)
    {
        var end = timeProvider.GetLocalNow();
        var start = end.AddDays(-CalendarDays);
        return await GetRangeAsync(start, end, false, cancellationToken);
    }

    public Task<UnifiedCalendar> GetUpcomingAsync(CancellationToken cancellationToken)
    {
        var start = timeProvider.GetLocalNow();
        return GetRangeAsync(start, start.AddDays(CalendarDays), true, cancellationToken);
    }

    private async Task<UnifiedCalendar> GetRangeAsync(DateTimeOffset start, DateTimeOffset end, bool ascending, CancellationToken cancellationToken)
    {
        var tasks = Enum.GetValues<EngineDomain>()
            .Select(domain => GetDomainAsync(domain, start, end, ascending, cancellationToken));
        var domains = await Task.WhenAll(tasks);

        return new UnifiedCalendar(
            start,
            end,
            domains.ToDictionary(item => item.Domain, StringComparer.Ordinal));
    }

    private async Task<CalendarDomain> GetDomainAsync(
        EngineDomain domain,
        DateTimeOffset start,
        DateTimeOffset end,
        bool ascending,
        CancellationToken cancellationToken)
    {
        var engine = registry.Get(domain);
        var apiKey = registry.GetApiKey(domain);
        if (engine.State != EngineState.Running || engine.Port is null || string.IsNullOrWhiteSpace(apiKey))
        {
            return new CalendarDomain(domain.Key(), [], "Engine is not available.");
        }

        try
        {
            var apiVersion = domain == EngineDomain.Movie ? "v3" : "v5";
            var baseUri = new Uri(
                $"http://127.0.0.1:{engine.Port}{domain.NativePathBase()}/api/{apiVersion}/",
                UriKind.Absolute);
            var startValue = Uri.EscapeDataString(start.UtcDateTime.ToString("O", CultureInfo.InvariantCulture));
            var endValue = Uri.EscapeDataString(end.UtcDateTime.ToString("O", CultureInfo.InvariantCulture));
            var calendarPath = domain == EngineDomain.Movie
                ? $"calendar?start={startValue}&end={endValue}&unmonitored=true"
                : $"calendar?start={startValue}&end={endValue}&includeUnmonitored=true&includeSpecials=true&includeSubresources=series&includeSubresources=episodeFile";
            var calendarTask = GetJsonAsync(baseUri, calendarPath, apiKey, cancellationToken);
            var queueTask = GetJsonAsync(baseUri, "queue?page=1&pageSize=1000", apiKey, cancellationToken);
            await Task.WhenAll(calendarTask, queueTask);

            using var calendar = await calendarTask;
            using var queue = await queueTask;
            var queuedIds = ReadQueuedIds(queue.RootElement, domain);
            var mapped = calendar.RootElement.EnumerateArray()
                .Select(item => domain == EngineDomain.Movie
                    ? MapMovie(item, queuedIds, start, end)
                    : MapEpisode(item, queuedIds, end))
                .Where(item => item is not null)
                .Cast<CalendarItem>();
            var items = (ascending ? mapped.OrderBy(item => item.Date) : mapped.OrderByDescending(item => item.Date)).ToArray();

            return new CalendarDomain(domain.Key(), items, null);
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException or TaskCanceledException)
        {
            return new CalendarDomain(domain.Key(), [], exception.Message);
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

    private static HashSet<int> ReadQueuedIds(JsonElement queue, EngineDomain domain)
    {
        if (!queue.TryGetProperty("records", out var records) || records.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var idName = domain == EngineDomain.Movie ? "movieId" : "episodeId";
        return records.EnumerateArray()
            .Select(record => ReadInt(record, idName))
            .Where(id => id > 0)
            .ToHashSet();
    }

    private static CalendarItem? MapMovie(
        JsonElement movie,
        IReadOnlySet<int> queuedIds,
        DateTimeOffset start,
        DateTimeOffset end)
    {
        var id = ReadInt(movie, "id");
        var date = new[] { "digitalRelease", "physicalRelease", "inCinemas" }
            .Select(name => ReadDate(movie, name))
            .Where(value => value is not null && value >= start && value <= end)
            .OrderByDescending(value => value)
            .FirstOrDefault() ?? ReadDate(movie, "inCinemas");
        if (id <= 0 || date is null)
        {
            return null;
        }

        var monitored = ReadBoolean(movie, "monitored");
        var hasFile = ReadBoolean(movie, "hasFile");
        var available = !movie.TryGetProperty("isAvailable", out var availability) || availability.ValueKind == JsonValueKind.True;
        var (status, key) = queuedIds.Contains(id)
            ? ("Queued", "queued")
            : hasFile
                ? monitored ? ("Downloaded (Monitored)", "downloaded-monitored") : ("Downloaded (Unmonitored)", "downloaded-unmonitored")
                : !available
                    ? ("Unreleased", "unreleased")
                    : monitored ? ("Missing (Monitored)", "missing-monitored") : ("Missing (Unmonitored)", "missing-unmonitored");
        var year = ReadInt(movie, "year");

        return new CalendarItem(
            id,
            ReadString(movie, "title") ?? "Untitled movie",
            year > 0 ? year.ToString(CultureInfo.InvariantCulture) : null,
            date.Value,
            status,
            key,
            $"/movies/movie/{ReadString(movie, "titleSlug") ?? id.ToString(CultureInfo.InvariantCulture)}");
    }

    private static CalendarItem? MapEpisode(
        JsonElement episode,
        IReadOnlySet<int> queuedIds,
        DateTimeOffset now)
    {
        var id = ReadInt(episode, "id");
        var date = ReadDate(episode, "airDateUtc");
        if (id <= 0 || date is null)
        {
            return null;
        }

        var monitored = ReadBoolean(episode, "monitored");
        var hasFile = ReadBoolean(episode, "hasFile");
        var episodeNumber = ReadInt(episode, "episodeNumber");
        var seasonNumber = ReadInt(episode, "seasonNumber");
        var (status, key) = queuedIds.Contains(id)
            ? ("Downloading", "downloading")
            : hasFile
                ? ("Downloaded", "downloaded")
                : !monitored
                    ? ("Unmonitored", "unmonitored")
                    : date > now
                        ? ("Unaired", "unaired")
                        : episodeNumber == 1
                            ? ("Premiere", "premiere")
                            : date > now.AddDays(-1)
                                ? ("On Air", "on-air")
                                : ("Missing", "missing");
        var series = episode.TryGetProperty("series", out var seriesValue) ? seriesValue : default;
        var seriesTitle = series.ValueKind == JsonValueKind.Object ? ReadString(series, "title") : null;
        var seriesSlug = series.ValueKind == JsonValueKind.Object ? ReadString(series, "titleSlug") : null;
        var episodeCode = $"S{seasonNumber:00}E{episodeNumber:00}";

        return new CalendarItem(
            id,
            seriesTitle ?? "Unknown series",
            $"{episodeCode} · {ReadString(episode, "title") ?? "Untitled episode"}",
            date.Value,
            status,
            key,
            seriesSlug is null ? "/television/" : $"/television/series/{seriesSlug}");
    }

    private static string? ReadString(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static int ReadInt(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.TryGetInt32(out var result) ? result : 0;

    private static bool ReadBoolean(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.True;

    private static DateTimeOffset? ReadDate(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String &&
        DateTimeOffset.TryParse(value.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var result)
            ? result
            : null;
}
