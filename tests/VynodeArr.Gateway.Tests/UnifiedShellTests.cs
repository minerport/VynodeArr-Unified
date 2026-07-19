using VynodeArr.Gateway;

namespace VynodeArr.Gateway.Tests;

public sealed class UnifiedShellTests
{
    [Fact]
    public void EmbedsBrandingAndContinuousEngineStatusRefresh()
    {
        Assert.Contains("src=\"/assets/vynodearr.png\"", UnifiedShell.Html, StringComparison.Ordinal);
        Assert.Contains("setTimeout(loadSummary, delay)", UnifiedShell.Html, StringComparison.Ordinal);
        Assert.Contains("cache: 'no-store'", UnifiedShell.Html, StringComparison.Ordinal);
        Assert.Contains("Starting' : 'Stopping", UnifiedShell.Html, StringComparison.Ordinal);
    }
}
