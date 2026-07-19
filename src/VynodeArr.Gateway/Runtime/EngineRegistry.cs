using System.Collections.Concurrent;

namespace VynodeArr.Gateway.Runtime;

public sealed class EngineRegistry(TimeProvider timeProvider)
{
    private readonly ConcurrentDictionary<EngineDomain, EngineStatus> _statuses = new();

    public EngineStatus Get(EngineDomain domain) => _statuses.GetOrAdd(
        domain,
        static (key, clock) => new EngineStatus(
            key.Key(),
            EngineState.Stopped,
            null,
            null,
            clock.GetUtcNow(),
            null),
        timeProvider);

    public void Set(
        EngineDomain domain,
        EngineState state,
        int? processId = null,
        int? port = null,
        string? detail = null)
    {
        _statuses[domain] = new EngineStatus(
            domain.Key(),
            state,
            processId,
            port,
            timeProvider.GetUtcNow(),
            detail);
    }

    public UnifiedHealth CreateHealthSnapshot()
    {
        var engines = Enum.GetValues<EngineDomain>()
            .ToDictionary(domain => domain.Key(), Get, StringComparer.Ordinal);
        var enabled = engines.Values.Where(status => status.State != EngineState.Disabled).ToArray();
        var status = enabled.Length == 0
            ? "configuration-required"
            : enabled.All(engine => engine.State == EngineState.Running)
                ? "healthy"
                : enabled.Any(engine => engine.State == EngineState.Running)
                    ? "degraded"
                    : "unavailable";

        return new UnifiedHealth(status, timeProvider.GetUtcNow(), engines);
    }
}
