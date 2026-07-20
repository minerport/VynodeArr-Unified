using VynodeArr.Gateway.Proxy;

namespace VynodeArr.Gateway.Tests;

public sealed class EngineProxyTests
{
    [Fact]
    public void RewritesPrivateEngineRedirectToGatewayRelativeLocation()
    {
        var upstream = new Uri("http://127.0.0.1:40223/television/");

        var result = EngineProxy.RewriteLocation(
            "http://127.0.0.1:40223/television/login?returnUrl=%2Ftelevision%2F#auth",
            upstream);

        Assert.Equal("/television/login?returnUrl=%2Ftelevision%2F#auth", result);
    }

    [Theory]
    [InlineData("/television/login", "/television/login")]
    [InlineData("https://identity.example.test/login", "https://identity.example.test/login")]
    [InlineData("http://127.0.0.1:9999/television/login", "http://127.0.0.1:9999/television/login")]
    public void PreservesRelativeAndExternalRedirects(string location, string expected)
    {
        var result = EngineProxy.RewriteLocation(
            location,
            new Uri("http://127.0.0.1:40223/television/"));

        Assert.Equal(expected, result);
    }
}
