using Microsoft.AspNetCore.Http;
using VynodeArr.Gateway.Auth;

namespace VynodeArr.Gateway.Tests;

public sealed class AuthEndpointsTests
{
    [Theory]
    [InlineData("/api/dashboard/summary", true)]
    [InlineData("/movies/api/v3/system/status", true)]
    [InlineData("/television/api/v5/system/status", true)]
    [InlineData("/movies/1", false)]
    [InlineData("/television/series/1", false)]
    public void ClassifiesUnifiedAndNativeApiRoutes(string path, bool expected)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;

        Assert.Equal(expected, AuthEndpoints.IsApiRequest(context.Request));
    }

    [Theory]
    [InlineData("/movies/1", "/movies/1")]
    [InlineData("/", "/")]
    [InlineData("https://evil.example", null)]
    [InlineData("//evil.example", null)]
    [InlineData("javascript:alert(1)", null)]
    [InlineData("/%0d%0aLocation:https://evil.example", null)]
    [InlineData("/%2f%2fevil.example", null)]
    public void RestrictsReturnUrlsToLocalRelativePaths(string value, string? expected) =>
        Assert.Equal(expected, AuthEndpoints.SafeReturnUrl(value));
}
