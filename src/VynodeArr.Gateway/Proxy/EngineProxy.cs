using System.Net;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Proxy;

public static class EngineProxy
{
    public const string ClientName = "engine-proxy";

    private static readonly string[] ForwardedRequestHeaders =
    [
        "Accept",
        "Accept-Language",
        "Content-Type",
        "If-Modified-Since",
        "If-None-Match",
        "Range"
    ];

    public static IEndpointRouteBuilder MapEngineProxy(
        this IEndpointRouteBuilder endpoints,
        string routeDomain,
        EngineDomain domain)
    {
        endpoints.MapMethods(
            $"/api/{routeDomain}/{{**path}}",
            ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
            (HttpContext context, string? path, EngineRegistry registry, IHttpClientFactory clients) =>
                ForwardAsync(context, path, domain, registry, clients));

        return endpoints;
    }

    private static async Task ForwardAsync(
        HttpContext context,
        string? path,
        EngineDomain domain,
        EngineRegistry registry,
        IHttpClientFactory clients)
    {
        var engine = registry.Get(domain);
        if (engine.State != EngineState.Running || engine.Port is null)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "engine_unavailable",
                domain = domain.Key(),
                state = engine.State.ToString().ToLowerInvariant()
            });
            return;
        }

        var target = new UriBuilder(Uri.UriSchemeHttp, IPAddress.Loopback.ToString(), engine.Port.Value)
        {
            Path = $"/api/{path ?? string.Empty}",
            Query = context.Request.QueryString.HasValue
                ? context.Request.QueryString.Value![1..]
                : string.Empty
        }.Uri;

        using var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), target);
        var apiKey = registry.GetApiKey(domain);
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "engine_credentials_unavailable",
                domain = domain.Key()
            });
            return;
        }

        request.Headers.TryAddWithoutValidation("X-Api-Key", apiKey);
        if (context.Request.ContentLength > 0 || context.Request.Headers.ContainsKey("Transfer-Encoding"))
        {
            request.Content = new StreamContent(context.Request.Body);
        }

        foreach (var header in ForwardedRequestHeaders)
        {
            if (!context.Request.Headers.TryGetValue(header, out var values))
            {
                continue;
            }

            if (!request.Headers.TryAddWithoutValidation(header, values.ToArray()))
            {
                request.Content?.Headers.TryAddWithoutValidation(header, values.ToArray());
            }
        }

        var client = clients.CreateClient(ClientName);
        using var response = await client.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            context.RequestAborted);

        context.Response.StatusCode = (int)response.StatusCode;
        foreach (var header in response.Headers.Concat(response.Content.Headers))
        {
            context.Response.Headers[header.Key] = header.Value.ToArray();
        }

        context.Response.Headers.Remove("transfer-encoding");
        await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
    }
}
