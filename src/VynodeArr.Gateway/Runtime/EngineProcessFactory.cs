using System.Diagnostics;

namespace VynodeArr.Gateway.Runtime;

public sealed class EngineProcessFactory(ILogger<EngineProcessFactory> logger) : IEngineProcessFactory, IDisposable
{
    private readonly WindowsProcessJob? _processJob = WindowsProcessJob.CreateIfSupported();

    public IEngineProcess Start(EngineLaunch launch)
    {
        var executable = Path.GetFullPath(launch.ExecutablePath);
        if (!File.Exists(executable))
        {
            throw new FileNotFoundException($"The {launch.Domain.Key()} engine executable was not found.", executable);
        }

        TerminateOrphanedPayloadInstances(executable);

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

        try
        {
            _processJob?.Assign(process);
        }
        catch
        {
            process.Kill(entireProcessTree: true);
            process.Dispose();
            throw;
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

    public void Dispose() => _processJob?.Dispose();

    private void TerminateOrphanedPayloadInstances(string executable)
    {
        var processName = Path.GetFileNameWithoutExtension(executable);
        foreach (var existing in Process.GetProcessesByName(processName))
        {
            using (existing)
            {
                try
                {
                    var existingPath = existing.MainModule?.FileName;
                    if (!string.Equals(existingPath, executable, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    logger.LogWarning(
                        "Stopping orphaned {Executable} process {ProcessId} before engine startup",
                        Path.GetFileName(executable),
                        existing.Id);
                    existing.Kill(entireProcessTree: true);
                    existing.WaitForExit(10000);
                }
                catch (InvalidOperationException)
                {
                    // The process exited while it was being inspected.
                }
                catch (System.ComponentModel.Win32Exception exception)
                {
                    logger.LogDebug(
                        exception,
                        "Unable to inspect unrelated {ProcessName} process {ProcessId}",
                        processName,
                        existing.Id);
                }
                catch (Exception exception)
                {
                    throw new InvalidOperationException(
                        $"An existing {Path.GetFileName(executable)} process could not be stopped safely.",
                        exception);
                }
            }
        }
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
