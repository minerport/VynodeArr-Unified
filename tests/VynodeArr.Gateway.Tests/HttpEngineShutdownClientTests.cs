using System.Net;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class HttpEngineShutdownClientTests
{
    [Theory]
    [InlineData(EngineDomain.Movie, 12001, "/movies/api/v3/system/shutdown")]
    [InlineData(EngineDomain.Television, 12002, "/television/api/v3/system/shutdown")]
    public async Task SendsAuthenticatedDomainShutdown(
        EngineDomain domain,
        int port,
        string expectedPath)
    {
        var handler = new CapturingHandler();
        var client = new HttpEngineShutdownClient(new HttpClient(handler));

        await client.RequestShutdownAsync(domain, port, "private-key", CancellationToken.None);

        Assert.Equal(HttpMethod.Post, handler.Method);
        Assert.Equal(port, handler.Uri?.Port);
        Assert.Equal(expectedPath, handler.Uri?.AbsolutePath);
        Assert.Equal("private-key", handler.ApiKey);
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public HttpMethod? Method { get; private set; }

        public Uri? Uri { get; private set; }

        public string? ApiKey { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Method = request.Method;
            Uri = request.RequestUri;
            ApiKey = request.Headers.GetValues("X-Api-Key").Single();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        }
    }
}
