namespace VynodeArr.Gateway.Runtime;

public interface IEngineShutdownClient
{
    Task RequestShutdownAsync(
        EngineDomain domain,
        int port,
        string apiKey,
        CancellationToken cancellationToken);
}

public sealed class HttpEngineShutdownClient(HttpClient client) : IEngineShutdownClient
{
    public async Task RequestShutdownAsync(
        EngineDomain domain,
        int port,
        string apiKey,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"http://127.0.0.1:{port}{domain.NativePathBase()}/api/v3/system/shutdown");
        request.Headers.Add("X-Api-Key", apiKey);
        using var response = await client.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }
}
