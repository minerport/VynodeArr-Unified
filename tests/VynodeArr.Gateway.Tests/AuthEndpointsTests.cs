using VynodeArr.Gateway.Auth;

namespace VynodeArr.Gateway.Tests;

public sealed class AuthEndpointsTests
{
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
