using System.Diagnostics;

namespace VynodeArr.Gateway.Runtime;

public sealed class EngineProcessFactory(ILogger<EngineProcessFactory> logger) : IEngineProcessFactory
{
    public IEngineProcess Start(EngineLaunch launch)
    {
        var executable = Path.GetFullPath(launch.ExecutablePath);
        if (!File.Exists(executable))
        {
            throw new FileNotFoundException($"The {launch.Domain.Key()} engine executable was not found.", executable);
        }

        Directory.CreateDirectory(launch.DataDirectory);
        var info = new ProcessStartInfo
        {
            FileName = executable,
            Arguments = launch.Arguments,
            WorkingDirectory = launch.WorkingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        var process = new Process { StartInfo = info, EnableRaisingEvents = true };
        foreach (var (name, value) in launch.EnvironmentVariables)
        {
            process.StartInfo.Environment[name] = value;
        }

        if (!process.Start())
        {
            process.Dispose();
            throw new InvalidOperationException($"The {launch.Domain.Key()} engine did not start.");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        logger.LogInformation(
            "Started {Domain} engine process {ProcessId} on loopback port {Port}",
            launch.Domain.Key(),
            process.Id,
            launch.Port);

        return new SystemEngineProcess(process);
    }

    private sealed class SystemEngineProcess(Process process) : IEngineProcess
    {
        public int Id => process.Id;

        public bool HasExited => process.HasExited;

        public async Task<int> WaitForExitAsync(CancellationToken cancellationToken)
        {
            await process.WaitForExitAsync(cancellationToken);
            return process.ExitCode;
        }

        public async Task StopAsync(TimeSpan timeout, CancellationToken cancellationToken)
        {
            if (process.HasExited)
            {
                return;
            }

            process.CloseMainWindow();
            using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutSource.CancelAfter(timeout);

            try
            {
                await process.WaitForExitAsync(timeoutSource.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                process.Kill(entireProcessTree: true);
                await process.WaitForExitAsync(cancellationToken);
            }
        }

        public ValueTask DisposeAsync()
        {
            process.Dispose();
            return ValueTask.CompletedTask;
        }
    }
}
