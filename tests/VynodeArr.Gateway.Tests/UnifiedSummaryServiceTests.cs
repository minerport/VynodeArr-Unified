using System.Net;
using System.Text;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class UnifiedSummaryServiceTests
{
    [Fact]
    public async Task KeepsDomainSummariesSeparate()
    {
        var registry = new EngineRegistry(TimeProvider.System);
        registry.Set(EngineDomain.Movie, EngineState.Running, 1, 12001);
        registry.Set(EngineDomain.Television, EngineState.Running, 2, 12002);
        registry.SetApiKey(EngineDomain.Movie, "movie-key");
        registry.SetApiKey(EngineDomain.Television, "tv-key");
        var handler = new SummaryHandler();
        var service = new UnifiedSummaryService(new HttpClient(handler), registry, TimeProvider.System);

        var result = await service.GetAsync(CancellationToken.None);

        Assert.Equal(2, result.Domains["movie"].LibraryItems);
        Assert.Equal(1, result.Domains["movie"].DownloadedFiles);
        Assert.Equal(5, result.Domains["television"].DownloadedFiles);
        Assert.Equal(3, result.Domains["movie"].MissingMonitored);
        Assert.Equal(7, result.Domains["television"].MissingMonitored);
        Assert.Equal("VynodeArr Movies", result.Domains["movie"].Application);
        Assert.Equal("VynodeArr Television", result.Domains["television"].Application);
        Assert.Equal(2, result.Domains["movie"].HealthIssues);
        Assert.Equal("No download client is available", result.Domains["movie"].Health[0].Message);
        Assert.Equal("IndexerStatusCheck", result.Domains["movie"].Health[1].Source);
        Assert.All(handler.MovieRequests, request => Assert.Equal("movie-key", request.ApiKey));
        Assert.All(handler.TelevisionRequests, request => Assert.Equal("tv-key", request.ApiKey));
    }

    private sealed class SummaryHandler : HttpMessageHandler
    {
        public List<CapturedRequest> MovieRequests { get; } = [];

        public List<CapturedRequest> TelevisionRequests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var movie = request.RequestUri!.Port == 12001;
            var requests = movie ? MovieRequests : TelevisionRequests;
            requests.Add(new CapturedRequest(
                request.RequestUri,
                request.Headers.GetValues("X-Api-Key").Single()));
            var path = request.RequestUri.AbsolutePath;
            var json = path.EndsWith("/system/status", StringComparison.Ordinal)
                ? movie ? "{\"appName\":\"Radarr\",\"version\":\"1\"}" : "{\"appName\":\"Sonarr\",\"version\":\"2\"}"
                : path.EndsWith("/movie", StringComparison.Ordinal)
                    ? "[{\"monitored\":true,\"hasFile\":true},{\"monitored\":false,\"hasFile\":false}]"
                    : path.EndsWith("/series", StringComparison.Ordinal)
                        ? "[{\"monitored\":true,\"statistics\":{\"episodeFileCount\":5}}]"
                        : path.EndsWith("/wanted/missing", StringComparison.Ordinal)
                            ? movie ? "{\"totalRecords\":3}" : "{\"totalRecords\":7}"
                            : path.EndsWith("/queue", StringComparison.Ordinal)
                                ? "{\"totalRecords\":2}"
                                : movie
                                    ? "[{\"source\":\"DownloadClientCheck\",\"type\":\"warning\",\"message\":\"No download client is available\"},{\"source\":\"IndexerStatusCheck\",\"type\":\"error\",\"message\":\"No indexers are available\"}]"
                                    : "[]";

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
        }
    }

    private sealed record CapturedRequest(Uri Uri, string ApiKey);
}
