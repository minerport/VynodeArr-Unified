using System.Net;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using VynodeArr.Gateway.Auth;
using VynodeArr.Gateway.Configuration;
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
                ForwardAsync(context, $"{domain.NativePathBase()}/api/{path ?? string.Empty}", domain, registry, clients))
            .RequireAuthorization(VynodeArrPolicies.Read);

        return endpoints;
    }

    public static IEndpointRouteBuilder MapNativeEngineProxy(
        this IEndpointRouteBuilder endpoints,
        string routeDomain,
        EngineDomain domain)
    {
        endpoints.MapMethods(
            $"/{routeDomain}/api/{{**path}}",
            ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
            async (HttpContext context, string? path, EngineRegistry registry, IHttpClientFactory clients) =>
            {
                var apiKey = registry.GetApiKey(domain);
                if (string.IsNullOrWhiteSpace(apiKey) || !HasValidEngineApiKey(context.Request, apiKey))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new { error = "invalid_api_key" });
                    return;
                }

                await ForwardAsync(
                    context,
                    $"/{routeDomain}/api/{path ?? string.Empty}",
                    domain,
                    registry,
                    clients,
                    apiKeyAuthenticated: true);
            })
            .AllowAnonymous();

        endpoints.MapMethods(
            $"/{routeDomain}/{{**path}}",
            ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
            (HttpContext context, string? path, EngineRegistry registry, IHttpClientFactory clients, IOptions<UnifiedOptions> options) =>
                ForwardAsync(context, $"/{routeDomain}/{path ?? string.Empty}", domain, registry, clients, options.Value.Ui))
            .RequireAuthorization(VynodeArrPolicies.Read);

        return endpoints;
    }

    private static async Task ForwardAsync(
        HttpContext context,
        string targetPath,
        EngineDomain domain,
        EngineRegistry registry,
        IHttpClientFactory clients,
        UiOptions? ui = null,
        bool apiKeyAuthenticated = false)
    {
        if (!apiKeyAuthenticated && IsNativeUpdatePage(context.Request.Path))
        {
            context.Response.Redirect($"{domain.NativePathBase()}/system/status");
            return;
        }

        if (!apiKeyAuthenticated &&
            !HttpMethods.IsGet(context.Request.Method) &&
            !HttpMethods.IsHead(context.Request.Method) &&
            !HttpMethods.IsOptions(context.Request.Method))
        {
            if (!context.User.IsInRole(VynodeArrRoles.Administrator))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
            if (!HasSameOrigin(context.Request))
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsJsonAsync(new { error = "invalid_request_origin" });
                return;
            }
        }

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

        var query = BuildQueryString(context.Request.Query, apiKey);
        var target = new UriBuilder(Uri.UriSchemeHttp, IPAddress.Loopback.ToString(), engine.Port.Value)
        {
            Path = targetPath,
            Query = query
        }.Uri;

        if (context.WebSockets.IsWebSocketRequest)
        {
            await ForwardWebSocketAsync(context, target, apiKey);
            return;
        }

        using var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), target);
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
        var isHtml = response.Content.Headers.ContentType?.MediaType?.Equals(
            "text/html",
            StringComparison.OrdinalIgnoreCase) == true;
        foreach (var header in response.Headers.Concat(response.Content.Headers))
        {
            if (isHtml && header.Key.Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (header.Key.Equals("Location", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.Headers.Location = RewriteLocation(header.Value.FirstOrDefault(), target);
                continue;
            }

            context.Response.Headers[header.Key] = header.Value.ToArray();
        }

        context.Response.Headers.Remove("transfer-encoding");
        if (isHtml && context.Response.StatusCode == StatusCodes.Status200OK)
        {
            var html = await response.Content.ReadAsStringAsync(context.RequestAborted);
            await context.Response.WriteAsync(
                NativeShellBranding.Transform(html, domain, ui ?? new UiOptions()),
                context.RequestAborted);
            return;
        }

        await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
    }

    internal static bool IsNativeUpdatePage(PathString path)
    {
        var value = path.Value?.TrimEnd('/');
        return value?.EndsWith("/system/updates", StringComparison.OrdinalIgnoreCase) == true;
    }

    internal static bool HasValidEngineApiKey(HttpRequest request, string expectedApiKey)
    {
        var suppliedApiKey = request.Headers["X-Api-Key"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(suppliedApiKey))
        {
            suppliedApiKey = request.Query["apikey"].FirstOrDefault();
        }
        if (string.IsNullOrWhiteSpace(suppliedApiKey))
        {
            suppliedApiKey = request.Query["access_token"].FirstOrDefault();
        }

        if (string.IsNullOrWhiteSpace(suppliedApiKey))
        {
            return false;
        }

        var suppliedBytes = Encoding.UTF8.GetBytes(suppliedApiKey);
        var expectedBytes = Encoding.UTF8.GetBytes(expectedApiKey);
        return suppliedBytes.Length == expectedBytes.Length &&
            CryptographicOperations.FixedTimeEquals(suppliedBytes, expectedBytes);
    }

    internal static bool HasSameOrigin(HttpRequest request)
    {
        var source = request.Headers.Origin.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(source))
        {
            source = request.Headers.Referer.FirstOrDefault();
        }
        if (!Uri.TryCreate(source, UriKind.Absolute, out var origin)) return false;
        return origin.Scheme.Equals(request.Scheme, StringComparison.OrdinalIgnoreCase) &&
               origin.Host.Equals(request.Host.Host, StringComparison.OrdinalIgnoreCase) &&
               origin.Port == (request.Host.Port ?? (request.IsHttps ? 443 : 80));
    }

    internal static string? RewriteLocation(string? location, Uri upstreamRequest)
    {
        if (string.IsNullOrWhiteSpace(location) ||
            !Uri.TryCreate(location, UriKind.Absolute, out var absoluteLocation) ||
            !absoluteLocation.Scheme.Equals(upstreamRequest.Scheme, StringComparison.OrdinalIgnoreCase) ||
            !absoluteLocation.Host.Equals(upstreamRequest.Host, StringComparison.OrdinalIgnoreCase) ||
            absoluteLocation.Port != upstreamRequest.Port)
        {
            return location;
        }

        return absoluteLocation.PathAndQuery + absoluteLocation.Fragment;
    }

    private static string BuildQueryString(IQueryCollection query, string apiKey)
    {
        var values = new List<string>();
        foreach (var (name, entries) in query)
        {
            if (name.Equals("access_token", StringComparison.OrdinalIgnoreCase) ||
                name.Equals("apikey", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            values.AddRange(entries.Select(value =>
                $"{Uri.EscapeDataString(name)}={Uri.EscapeDataString(value ?? string.Empty)}"));
        }

        if (query.ContainsKey("access_token"))
        {
            values.Add($"access_token={Uri.EscapeDataString(apiKey)}");
        }
        if (query.ContainsKey("apikey"))
        {
            values.Add($"apikey={Uri.EscapeDataString(apiKey)}");
        }

        return string.Join('&', values);
    }

    private static async Task ForwardWebSocketAsync(HttpContext context, Uri httpTarget, string apiKey)
    {
        var builder = new UriBuilder(httpTarget)
        {
            Scheme = Uri.UriSchemeWs
        };
        using var upstream = new ClientWebSocket();
        upstream.Options.SetRequestHeader("X-Api-Key", apiKey);
        await upstream.ConnectAsync(builder.Uri, context.RequestAborted);
        using var downstream = await context.WebSockets.AcceptWebSocketAsync();

        var upstreamToDownstream = CopyWebSocketAsync(upstream, downstream, context.RequestAborted);
        var downstreamToUpstream = CopyWebSocketAsync(downstream, upstream, context.RequestAborted);
        await Task.WhenAny(upstreamToDownstream, downstreamToUpstream);

        if (downstream.State is WebSocketState.Open or WebSocketState.CloseReceived)
        {
            await downstream.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        }
        if (upstream.State is WebSocketState.Open or WebSocketState.CloseReceived)
        {
            await upstream.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        }
    }

    private static async Task CopyWebSocketAsync(
        WebSocket source,
        WebSocket destination,
        CancellationToken cancellationToken)
    {
        var buffer = new byte[16 * 1024];
        while (!cancellationToken.IsCancellationRequested && source.State == WebSocketState.Open)
        {
            var result = await source.ReceiveAsync(buffer, cancellationToken);
            if (result.MessageType == WebSocketMessageType.Close)
            {
                return;
            }

            await destination.SendAsync(
                new ArraySegment<byte>(buffer, 0, result.Count),
                result.MessageType,
                result.EndOfMessage,
                cancellationToken);
        }
    }
}
