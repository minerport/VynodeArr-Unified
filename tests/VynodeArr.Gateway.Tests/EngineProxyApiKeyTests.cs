using Microsoft.AspNetCore.Http;
using VynodeArr.Gateway.Proxy;

namespace VynodeArr.Gateway.Tests;

public sealed class EngineProxyApiKeyTests
{
    [Theory]
    [InlineData("header")]
    [InlineData("query")]
    [InlineData("access_token")]
    public void AcceptsSupportedEngineApiKeyLocations(string location)
    {
        var context = new DefaultHttpContext();
        const string apiKey = "0123456789abcdef0123456789abcdef";
        if (location == "header") context.Request.Headers["X-Api-Key"] = apiKey;
        if (location == "query") context.Request.QueryString = new QueryString($"?apikey={apiKey}");
        if (location == "access_token") context.Request.QueryString = new QueryString($"?access_token={apiKey}");

        Assert.True(EngineProxy.HasValidEngineApiKey(context.Request, apiKey));
    }

    [Theory]
    [InlineData("")]
    [InlineData("wrong")]
    [InlineData("0123456789abcdef0123456789abcdee")]
    public void RejectsMissingOrIncorrectEngineApiKeys(string suppliedApiKey)
    {
        var context = new DefaultHttpContext();
        if (suppliedApiKey.Length > 0) context.Request.Headers["X-Api-Key"] = suppliedApiKey;

        Assert.False(EngineProxy.HasValidEngineApiKey(
            context.Request,
            "0123456789abcdef0123456789abcdef"));
    }
}
