using System.Net;
using System.Security.Cryptography;
using System.Text;
using VynodeArr.Gateway.Configuration;

namespace VynodeArr.Gateway;

public static class LifecycleRequestAuthorizer
{
    public const string HeaderName = "X-VynodeArr-Control-Key";

    public static bool IsAuthorized(HttpContext context, UnifiedOptions options)
    {
        if (context.Connection.RemoteIpAddress is { } address && IPAddress.IsLoopback(address))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(options.LifecycleApiKey) ||
            !context.Request.Headers.TryGetValue(HeaderName, out var provided))
        {
            return false;
        }

        var expectedBytes = Encoding.UTF8.GetBytes(options.LifecycleApiKey);
        var providedBytes = Encoding.UTF8.GetBytes(provided.ToString());
        return expectedBytes.Length == providedBytes.Length &&
               CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }
}
