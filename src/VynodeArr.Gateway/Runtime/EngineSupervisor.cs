using Microsoft.Extensions.Options;
using System.Collections.Concurrent;
using VynodeArr.Gateway.Configuration;

namespace VynodeArr.Gateway.Runtime;

public sealed class EngineSupervisor(
    IOptions<UnifiedOptions> options,
    IHostEnvironment environment,
    IPortAllocator portAllocator,
    IEngineProcessFactory processFactory,
    IEngineReadinessProbe readinessProbe,
    EngineRegistry registry,
    ILogger<EngineSupervisor> logger) : BackgroundService
{
    private readonly ConcurrentDictionary<EngineDomain, IEngineProcess> _processes = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var workers = Enum.GetValues<EngineDomain>()
            .Select(domain => SuperviseAsync(domain, stoppingToken));

        await Task.WhenAll(workers);
    }

    private async Task SuperviseAsync(EngineDomain domain, CancellationToken stoppingToken)
    {
        var settings = options.Value.Engines.For(domain);
        if (!settings.Enabled)
        {
            registry.Set(domain, EngineState.Disabled, detail: "Engine is disabled in configuration.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            IEngineProcess? process = null;
            var port = portAllocator.Allocate();

            try
            {
                registry.Set(domain, EngineState.Starting, port: port);
                var launch = CreateLaunch(domain, settings, port);
                process = processFactory.Start(launch);
                _processes[domain] = process;
                await readinessProbe.WaitUntilReadyAsync(
                    domain,
                    settings,
                    process,
                    port,
                    TimeSpan.FromSeconds(options.Value.StartupTimeoutSeconds),
                    stoppingToken);
                registry.Set(domain, EngineState.Running, process.Id, port);

                var exitCode = await process.WaitForExitAsync(stoppingToken);
                registry.Set(
                    domain,
                    EngineState.Faulted,
                    process.Id,
                    port,
                    $"Engine exited with code {exitCode}.");
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                registry.Set(domain, EngineState.Faulted, process?.Id, port, exception.Message);
                logger.LogError(exception, "The {Domain} engine failed", domain.Key());

                if (process is { HasExited: false })
                {
                    try
                    {
                        await process.StopAsync(
                            TimeSpan.FromSeconds(options.Value.ShutdownTimeoutSeconds),
                            CancellationToken.None);
                    }
                    catch (Exception stopException)
                    {
                        logger.LogError(
                            stopException,
                            "The unhealthy {Domain} engine could not be stopped cleanly",
                            domain.Key());
                    }
                }
            }
            finally
            {
                _processes.TryRemove(domain, out _);
                if (process is not null)
                {
                    await process.DisposeAsync();
                }
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(options.Value.RestartDelaySeconds), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private EngineLaunch CreateLaunch(EngineDomain domain, EngineOptions settings, int port)
    {
        var contentRoot = environment.ContentRootPath;
        var executable = Path.GetFullPath(
            Path.IsPathRooted(settings.ExecutablePath)
                ? settings.ExecutablePath
                : Path.Combine(contentRoot, settings.ExecutablePath));
        var dataDirectory = Path.Combine(options.Value.ResolveDataRoot(contentRoot), domain.Key());
        var arguments = settings.Arguments
            .Replace("{data}", Quote(dataDirectory), StringComparison.Ordinal)
            .Replace("{port}", port.ToString(System.Globalization.CultureInfo.InvariantCulture), StringComparison.Ordinal);

        return new EngineLaunch(
            domain,
            executable,
            arguments,
            Path.GetDirectoryName(executable)!,
            dataDirectory,
            port);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        foreach (var (domain, process) in _processes.ToArray())
        {
            registry.Set(domain, EngineState.Stopping, process.Id, registry.Get(domain).Port);
            await process.StopAsync(
                TimeSpan.FromSeconds(options.Value.ShutdownTimeoutSeconds),
                cancellationToken);
            registry.Set(domain, EngineState.Stopped);
        }

        await base.StopAsync(cancellationToken);
    }

    private static string Quote(string value) => $"\"{value.Replace("\"", "\\\"", StringComparison.Ordinal)}\"";
}
