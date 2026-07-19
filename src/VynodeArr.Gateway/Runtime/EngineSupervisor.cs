using System.Collections.Concurrent;
using Microsoft.Extensions.Options;
using VynodeArr.Gateway.Configuration;

namespace VynodeArr.Gateway.Runtime;

public sealed class EngineSupervisor(
    IOptions<UnifiedOptions> options,
    IHostEnvironment environment,
    IPortAllocator portAllocator,
    IEngineProcessFactory processFactory,
    IEngineReadinessProbe readinessProbe,
    IEngineApiKeyProvider apiKeyProvider,
    EngineRegistry registry,
    ILogger<EngineSupervisor> logger) : BackgroundService
{
    private readonly ConcurrentDictionary<EngineDomain, IEngineProcess> _processes = new();
    private readonly CancellationTokenSource _shutdownSource = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var linkedSource = CancellationTokenSource.CreateLinkedTokenSource(
            stoppingToken,
            _shutdownSource.Token);
        var workers = Enum.GetValues<EngineDomain>()
            .Select(domain => SuperviseAsync(domain, linkedSource.Token));

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
                var apiKey = await apiKeyProvider.ReadAsync(
                    launch.DataDirectory,
                    TimeSpan.FromSeconds(options.Value.StartupTimeoutSeconds),
                    stoppingToken);
                registry.SetApiKey(domain, apiKey);
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
                if (process is { HasExited: false })
                {
                    registry.Set(domain, EngineState.Stopping, process.Id, port);
                    await StopProcessSafelyAsync(domain, process);
                    registry.Set(domain, EngineState.Stopped);
                }

                break;
            }
            catch (Exception exception)
            {
                registry.Set(domain, EngineState.Faulted, process?.Id, port, exception.Message);
                logger.LogError(exception, "The {Domain} engine failed", domain.Key());

                if (process is { HasExited: false })
                {
                    await StopProcessSafelyAsync(domain, process);
                }
            }
            finally
            {
                registry.ClearApiKey(domain);
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
            port,
            CreateEnvironment(domain, port));
    }

    private static IReadOnlyDictionary<string, string> CreateEnvironment(EngineDomain domain, int port)
    {
        var publicProduct = domain == EngineDomain.Movie ? "VynodeMovies" : "VynodeTV";
        var compatibilityProduct = domain == EngineDomain.Movie ? "Radarr" : "Sonarr";
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var product in new[] { publicProduct, compatibilityProduct })
        {
            values[$"{product}__Server__Port"] = port.ToString(System.Globalization.CultureInfo.InvariantCulture);
            values[$"{product}__Server__BindAddress"] = "127.0.0.1";
            values[$"{product}__Server__EnableSsl"] = "false";
            values[$"{product}__Server__UrlBase"] = domain.NativePathBase();
        }

        return values;
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _shutdownSource.Cancel();
        await base.StopAsync(cancellationToken);
    }

    public override void Dispose()
    {
        _shutdownSource.Dispose();
        base.Dispose();
    }

    private async Task StopProcessSafelyAsync(EngineDomain domain, IEngineProcess process)
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
                "The {Domain} engine could not be stopped cleanly",
                domain.Key());
        }
    }

    private static string Quote(string value) => $"\"{value.Replace("\"", "\\\"", StringComparison.Ordinal)}\"";
}
