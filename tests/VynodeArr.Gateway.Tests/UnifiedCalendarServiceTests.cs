using System.Net;
using System.Text;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class UnifiedCalendarServiceTests
{
    [Fact]
    public async Task NormalizesMovieAndTelevisionCalendarStatuses()
    {
        var now = new DateTimeOffset(2026, 7, 19, 20, 0, 0, TimeSpan.Zero);
        var registry = new EngineRegistry(TimeProvider.System);
        registry.Set(EngineDomain.Movie, EngineState.Running, 1, 12001);
        registry.Set(EngineDomain.Television, EngineState.Running, 2, 12002);
        registry.SetApiKey(EngineDomain.Movie, "movie-key");
        registry.SetApiKey(EngineDomain.Television, "tv-key");
        var handler = new CalendarHandler();
        var service = new UnifiedCalendarService(
            new HttpClient(handler),
            registry,
            new FixedTimeProvider(now));

        var result = await service.GetAsync(CancellationToken.None);

        Assert.Equal(
            ["downloaded-monitored", "downloaded-unmonitored", "missing-monitored", "missing-unmonitored", "queued", "unreleased"],
            result.Domains["movie"].Items.Select(item => item.StatusKey).Order().ToArray());
        Assert.Equal(
            ["downloaded", "downloading", "missing", "on-air", "premiere", "unaired", "unmonitored"],
            result.Domains["television"].Items.Select(item => item.StatusKey).Order().ToArray());
        Assert.Contains(handler.Requests, request => request.AbsolutePath.EndsWith("/movies/api/v3/calendar", StringComparison.Ordinal) && request.Query.Contains("unmonitored=true", StringComparison.Ordinal));
        Assert.Contains(handler.Requests, request => request.AbsolutePath.EndsWith("/television/api/v5/calendar", StringComparison.Ordinal) && request.Query.Contains("includeUnmonitored=true", StringComparison.Ordinal));
        Assert.All(handler.ApiKeys.Where(pair => pair.Port == 12001), pair => Assert.Equal("movie-key", pair.ApiKey));
        Assert.All(handler.ApiKeys.Where(pair => pair.Port == 12002), pair => Assert.Equal("tv-key", pair.ApiKey));
    }

    private sealed class CalendarHandler : HttpMessageHandler
    {
        public List<Uri> Requests { get; } = [];

        public List<(int Port, string ApiKey)> ApiKeys { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var uri = request.RequestUri!;
            var movie = uri.Port == 12001;
            Requests.Add(uri);
            ApiKeys.Add((uri.Port, request.Headers.GetValues("X-Api-Key").Single()));
            var queue = uri.AbsolutePath.EndsWith("/queue", StringComparison.Ordinal);
            var json = queue
                ? movie ? "{\"records\":[{\"movieId\":5}]}" : "{\"records\":[{\"episodeId\":11}]}"
                : movie ? MovieCalendar : TelevisionCalendar;

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
        }

        private const string MovieCalendar = """
            [
              {"id":1,"title":"A","titleSlug":"a","year":2020,"monitored":true,"hasFile":true,"isAvailable":true,"digitalRelease":"2026-07-18T00:00:00Z"},
              {"id":2,"title":"B","titleSlug":"b","year":2021,"monitored":false,"hasFile":true,"isAvailable":true,"digitalRelease":"2026-07-17T00:00:00Z"},
              {"id":3,"title":"C","titleSlug":"c","year":2022,"monitored":true,"hasFile":false,"isAvailable":true,"digitalRelease":"2026-07-16T00:00:00Z"},
              {"id":4,"title":"D","titleSlug":"d","year":2023,"monitored":false,"hasFile":false,"isAvailable":true,"digitalRelease":"2026-07-15T00:00:00Z"},
              {"id":5,"title":"E","titleSlug":"e","year":2024,"monitored":true,"hasFile":false,"isAvailable":true,"digitalRelease":"2026-07-14T00:00:00Z"},
              {"id":6,"title":"F","titleSlug":"f","year":2025,"monitored":true,"hasFile":false,"isAvailable":false,"inCinemas":"2026-07-13T00:00:00Z"}
            ]
            """;

        private const string TelevisionCalendar = """
            [
              {"id":10,"title":"Downloaded","seasonNumber":2,"episodeNumber":2,"monitored":true,"hasFile":true,"airDateUtc":"2026-07-17T20:00:00Z","series":{"title":"Show A","titleSlug":"show-a"}},
              {"id":11,"title":"Downloading","seasonNumber":2,"episodeNumber":3,"monitored":true,"hasFile":false,"airDateUtc":"2026-07-18T20:00:00Z","series":{"title":"Show B","titleSlug":"show-b"}},
              {"id":12,"title":"Unmonitored","seasonNumber":2,"episodeNumber":4,"monitored":false,"hasFile":false,"airDateUtc":"2026-07-16T20:00:00Z","series":{"title":"Show C","titleSlug":"show-c"}},
              {"id":13,"title":"Unaired","seasonNumber":2,"episodeNumber":5,"monitored":true,"hasFile":false,"airDateUtc":"2026-07-20T20:00:00Z","series":{"title":"Show D","titleSlug":"show-d"}},
              {"id":14,"title":"Premiere","seasonNumber":1,"episodeNumber":1,"monitored":true,"hasFile":false,"airDateUtc":"2026-07-17T20:00:00Z","series":{"title":"Show E","titleSlug":"show-e"}},
              {"id":15,"title":"On Air","seasonNumber":2,"episodeNumber":6,"monitored":true,"hasFile":false,"airDateUtc":"2026-07-19T12:00:00Z","series":{"title":"Show F","titleSlug":"show-f"}},
              {"id":16,"title":"Missing","seasonNumber":2,"episodeNumber":7,"monitored":true,"hasFile":false,"airDateUtc":"2026-07-15T20:00:00Z","series":{"title":"Show G","titleSlug":"show-g"}}
            ]
            """;
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
