using System.Net;
using Microsoft.AspNetCore.Http;
using VynodeArr.Gateway.Configuration;

namespace VynodeArr.Gateway.Tests;

public sealed class LifecycleRequestAuthorizerTests
{
    [Fact]
    public void AllowsLoopbackWithoutAConfiguredKey()
    {
        var context = CreateContext(IPAddress.Loopback);

        Assert.True(LifecycleRequestAuthorizer.IsAuthorized(context, new UnifiedOptions()));
    }

    [Fact]
    public void RejectsRemoteRequestWithoutAConfiguredKey()
    {
        var context = CreateContext(IPAddress.Parse("192.168.1.20"));

        Assert.False(LifecycleRequestAuthorizer.IsAuthorized(context, new UnifiedOptions()));
    }

    [Fact]
    public void AllowsOnlyMatchingRemoteControlKey()
    {
        var options = new UnifiedOptions { LifecycleApiKey = "private-control-key" };
        var accepted = CreateContext(IPAddress.Parse("192.168.1.20"));
        accepted.Request.Headers[LifecycleRequestAuthorizer.HeaderName] = "private-control-key";
        var rejected = CreateContext(IPAddress.Parse("192.168.1.21"));
        rejected.Request.Headers[LifecycleRequestAuthorizer.HeaderName] = "wrong-key";

        Assert.True(LifecycleRequestAuthorizer.IsAuthorized(accepted, options));
        Assert.False(LifecycleRequestAuthorizer.IsAuthorized(rejected, options));
    }

    private static DefaultHttpContext CreateContext(IPAddress remoteAddress)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = remoteAddress;
        return context;
    }
}
