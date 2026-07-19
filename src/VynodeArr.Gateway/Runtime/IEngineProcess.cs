namespace VynodeArr.Gateway.Runtime;

public interface IEngineProcess : IAsyncDisposable
{
    int Id { get; }

    bool HasExited { get; }

    Task<int> WaitForExitAsync(CancellationToken cancellationToken);

    Task StopAsync(TimeSpan timeout, CancellationToken cancellationToken);
}

public interface IEngineProcessFactory
{
    IEngineProcess Start(EngineLaunch launch);
}

public sealed record EngineLaunch(
    EngineDomain Domain,
    string ExecutablePath,
    string Arguments,
    string WorkingDirectory,
    string DataDirectory,
    int Port,
    IReadOnlyDictionary<string, string> EnvironmentVariables);
