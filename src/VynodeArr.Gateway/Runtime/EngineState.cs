namespace VynodeArr.Gateway.Runtime;

public enum EngineState
{
    Disabled,
    Starting,
    Running,
    Degraded,
    Stopping,
    Stopped,
    Faulted
}

public sealed record EngineStatus(
    string Domain,
    EngineState State,
    int? ProcessId,
    int? Port,
    DateTimeOffset UpdatedAt,
    string? Detail);

public sealed record UnifiedHealth(
    string Status,
    DateTimeOffset Timestamp,
    IReadOnlyDictionary<string, EngineStatus> Engines);
