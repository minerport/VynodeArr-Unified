using System.Net;
using System.Text;
using VynodeArr.Gateway.Dashboard;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class DashboardClientsTests
{
    [Fact]
    public async Task KeepsMovieAndTelevisionQueueMappingsDistinct()
    {
        var registry = new EngineRegistry(TimeProvider.System);
        registry.Set(EngineDomain.Movie, EngineState.Running, 1, 12001); registry.SetApiKey(EngineDomain.Movie, "movie-key");
        registry.Set(EngineDomain.Television, EngineState.Running, 2, 12002); registry.SetApiKey(EngineDomain.Television, "tv-key");
        var handler = new QueueHandler();
        var movie = await new MoviesDashboardClient(new HttpClient(handler), registry).GetQueueAsync(10, default);
        var television = await new TelevisionDashboardClient(new HttpClient(handler), registry).GetQueueAsync(10, default);
        Assert.Equal("movies:4", Assert.Single(movie.Data!).Key);
        Assert.Equal("Film", Assert.Single(movie.Data!).Title);
        Assert.Equal("television:9", Assert.Single(television.Data!).Key);
        Assert.Equal("Series", Assert.Single(television.Data!).Title);
        Assert.Equal("Episode", Assert.Single(television.Data!).Subtitle);
        Assert.Equal(["movie-key", "tv-key"], handler.Keys);
    }

    private sealed class QueueHandler : HttpMessageHandler
    {
        public List<string> Keys { get; } = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Keys.Add(request.Headers.GetValues("X-Api-Key").Single());
            var json = request.RequestUri!.Port == 12001
                ? "{\"records\":[{\"id\":4,\"title\":\"Film\",\"status\":\"downloading\",\"size\":100,\"sizeleft\":25}]}"
                : "{\"records\":[{\"id\":9,\"series\":{\"title\":\"Series\"},\"episode\":{\"title\":\"Episode\"},\"status\":\"queued\"}]}";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        }
    }
}
