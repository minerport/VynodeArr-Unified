using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using VynodeArr.Gateway.Configuration;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Tests;

public sealed class EngineSupervisorTests
{
    [Fact]
    public async Task LaunchesEnginesWithSeparateLoopbackConfiguration()
    {
        var dataRoot = Path.Combine(Path.GetTempPath(), $"vynodearr-tests-{Guid.NewGuid():N}");
        var registry = new EngineRegistry(TimeProvider.System);
        var factory = new FakeEngineProcessFactory();
        var supervisor = new EngineSupervisor(
            Options.Create(CreateOptions(dataRoot)),
            new TestHostEnvironment(dataRoot),
            new SequentialPortAllocator(),
            factory,
            new ImmediateReadinessProbe(),
            new StaticApiKeyProvider(),
            registry,
            NullLogger<EngineSupervisor>.Instance);

        try
        {
            await supervisor.StartAsync(CancellationToken.None);
            await WaitForAsync(() => factory.Launches.Count == 2);

            var movie = factory.Launches[EngineDomain.Movie];
            var television = factory.Launches[EngineDomain.Television];
            Assert.Equal("127.0.0.1", movie.EnvironmentVariables["Radarr__Server__BindAddress"]);
            Assert.Equal(movie.Port.ToString(), movie.EnvironmentVariables["Radarr__Server__Port"]);
            Assert.Equal("127.0.0.1", television.EnvironmentVariables["Sonarr__Server__BindAddress"]);
            Assert.Equal(television.Port.ToString(), television.EnvironmentVariables["Sonarr__Server__Port"]);
            Assert.NotEqual(movie.Port, television.Port);
            Assert.DoesNotContain("port", movie.Arguments, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("port", television.Arguments, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            await supervisor.StopAsync(CancellationToken.None);
            supervisor.Dispose();
            if (Directory.Exists(dataRoot))
            {
                Directory.Delete(dataRoot, recursive: true);
            }
        }
    }

    [Fact]
    public async Task UnreadyMovieIsStoppedWithoutStoppingTelevisionEngine()
    {
        var dataRoot = Path.Combine(Path.GetTempPath(), $"vynodearr-tests-{Guid.NewGuid():N}");
        var registry = new EngineRegistry(TimeProvider.System);
        var factory = new FakeEngineProcessFactory();
        var supervisor = new EngineSupervisor(
            Options.Create(CreateOptions(dataRoot)),
            new TestHostEnvironment(dataRoot),
            new SequentialPortAllocator(),
            factory,
            new DomainReadinessProbe(EngineDomain.Movie),
            new StaticApiKeyProvider(),
            registry,
            NullLogger<EngineSupervisor>.Instance);

        try
        {
            await supervisor.StartAsync(CancellationToken.None);
            await WaitForAsync(
                () => registry.Get(EngineDomain.Movie).State == EngineState.Faulted &&
                      registry.Get(EngineDomain.Television).State == EngineState.Running);

            Assert.True(factory.Processes[EngineDomain.Movie].StopRequested);
            Assert.False(factory.Processes[EngineDomain.Television].StopRequested);
            Assert.Equal(1, factory.StartCounts[EngineDomain.Television]);
        }
        finally
        {
            await supervisor.StopAsync(CancellationToken.None);
            supervisor.Dispose();
            if (Directory.Exists(dataRoot))
            {
                Directory.Delete(dataRoot, recursive: true);
            }
        }
    }

    [Fact]
    public async Task MovieExitDoesNotStopTelevisionEngine()
    {
        var dataRoot = Path.Combine(Path.GetTempPath(), $"vynodearr-tests-{Guid.NewGuid():N}");
        var registry = new EngineRegistry(TimeProvider.System);
        var factory = new FakeEngineProcessFactory();
        var supervisor = new EngineSupervisor(
            Options.Create(CreateOptions(dataRoot)),
            new TestHostEnvironment(dataRoot),
            new SequentialPortAllocator(),
            factory,
            new ImmediateReadinessProbe(),
            new StaticApiKeyProvider(),
            registry,
            NullLogger<EngineSupervisor>.Instance);

        try
        {
            await supervisor.StartAsync(CancellationToken.None);
            await WaitForAsync(
                () => registry.Get(EngineDomain.Television).State == EngineState.Running &&
                      registry.Get(EngineDomain.Movie).State == EngineState.Running);

            factory.Processes[EngineDomain.Movie].Exit(17);

            await WaitForAsync(() => registry.Get(EngineDomain.Movie).State == EngineState.Faulted);
            var television = registry.Get(EngineDomain.Television);

            Assert.Equal(EngineState.Running, television.State);
            Assert.False(factory.Processes[EngineDomain.Television].StopRequested);
            Assert.Equal(1, factory.StartCounts[EngineDomain.Television]);
        }
        finally
        {
            await supervisor.StopAsync(CancellationToken.None);
            supervisor.Dispose();
            if (Directory.Exists(dataRoot))
            {
                Directory.Delete(dataRoot, recursive: true);
            }
        }
    }

    private static UnifiedOptions CreateOptions(string dataRoot) => new()
    {
        DataRoot = dataRoot,
        RestartDelaySeconds = 30,
        ShutdownTimeoutSeconds = 1,
        Engines = new EngineOptionsGroup
        {
            Movie = new EngineOptions
            {
                Enabled = true,
                ExecutablePath = "movie.exe",
                Arguments = "/nobrowser /data={data}"
            },
            Television = new EngineOptions
            {
                Enabled = true,
                ExecutablePath = "television.exe",
                Arguments = "/nobrowser /data={data}"
            }
        }
    };

    private static async Task WaitForAsync(Func<bool> condition)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        while (!condition())
        {
            await Task.Delay(20, timeout.Token);
        }
    }

    private sealed class SequentialPortAllocator : IPortAllocator
    {
        private int _port = 12000;

        public int Allocate() => Interlocked.Increment(ref _port);
    }

    private sealed class ImmediateReadinessProbe : IEngineReadinessProbe
    {
        public Task WaitUntilReadyAsync(
            EngineDomain domain,
            EngineOptions settings,
            IEngineProcess process,
            int port,
            TimeSpan timeout,
            CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class DomainReadinessProbe(EngineDomain failingDomain) : IEngineReadinessProbe
    {
        public Task WaitUntilReadyAsync(
            EngineDomain domain,
            EngineOptions settings,
            IEngineProcess process,
            int port,
            TimeSpan timeout,
            CancellationToken cancellationToken) => domain == failingDomain
                ? Task.FromException(new TimeoutException($"{domain.Key()} did not become ready."))
                : Task.CompletedTask;
    }

    private sealed class StaticApiKeyProvider : IEngineApiKeyProvider
    {
        public Task<string> ReadAsync(
            string dataDirectory,
            TimeSpan timeout,
            CancellationToken cancellationToken) => Task.FromResult("test-api-key");
    }

    private sealed class FakeEngineProcessFactory : IEngineProcessFactory
    {
        public Dictionary<EngineDomain, FakeEngineProcess> Processes { get; } = [];

        public Dictionary<EngineDomain, int> StartCounts { get; } = [];

        public Dictionary<EngineDomain, EngineLaunch> Launches { get; } = [];

        public IEngineProcess Start(EngineLaunch launch)
        {
            var process = new FakeEngineProcess(launch.Domain == EngineDomain.Movie ? 101 : 202);
            Processes[launch.Domain] = process;
            Launches[launch.Domain] = launch;
            StartCounts[launch.Domain] = StartCounts.GetValueOrDefault(launch.Domain) + 1;
            return process;
        }
    }

    private sealed class FakeEngineProcess(int id) : IEngineProcess
    {
        private readonly TaskCompletionSource<int> _exit = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public int Id { get; } = id;

        public bool HasExited => _exit.Task.IsCompleted;

        public bool StopRequested { get; private set; }

        public void Exit(int code) => _exit.TrySetResult(code);

        public Task<int> WaitForExitAsync(CancellationToken cancellationToken) =>
            _exit.Task.WaitAsync(cancellationToken);

        public Task StopAsync(TimeSpan timeout, CancellationToken cancellationToken)
        {
            StopRequested = true;
            _exit.TrySetResult(0);
            return Task.CompletedTask;
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    private sealed class TestHostEnvironment(string contentRoot) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;

        public string ApplicationName { get; set; } = "VynodeArr.Gateway.Tests";

        public string ContentRootPath { get; set; } = contentRoot;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
