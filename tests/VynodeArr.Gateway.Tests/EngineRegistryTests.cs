using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class EngineRegistryTests
{
    [Fact]
    public void ReportsConfigurationRequiredWhenBothEnginesAreDisabled()
    {
        var registry = new EngineRegistry(TimeProvider.System);
        registry.Set(EngineDomain.Movie, EngineState.Disabled);
        registry.Set(EngineDomain.Television, EngineState.Disabled);

        var result = registry.CreateHealthSnapshot();

        Assert.Equal("configuration-required", result.Status);
        Assert.Equal(EngineState.Disabled, result.Engines["movie"].State);
        Assert.Equal(EngineState.Disabled, result.Engines["television"].State);
    }

    [Fact]
    public void ReportsDegradedWithoutChangingHealthyEngineState()
    {
        var registry = new EngineRegistry(TimeProvider.System);
        registry.Set(EngineDomain.Movie, EngineState.Faulted, detail: "test failure");
        registry.Set(EngineDomain.Television, EngineState.Running, processId: 22, port: 12002);

        var result = registry.CreateHealthSnapshot();

        Assert.Equal("degraded", result.Status);
        Assert.Equal(EngineState.Faulted, result.Engines["movie"].State);
        Assert.Equal(EngineState.Running, result.Engines["television"].State);
        Assert.Equal(22, result.Engines["television"].ProcessId);
    }
}
