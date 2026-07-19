using System.ComponentModel.DataAnnotations;
using VynodeArr.Gateway.Runtime;

namespace VynodeArr.Gateway.Configuration;

public sealed class UnifiedOptions
{
    public const string SectionName = "VynodeArr";

    [Required]
    public string DataRoot { get; init; } = "runtime/data";

    [Range(1, 600)]
    public int StartupTimeoutSeconds { get; init; } = 90;

    [Range(1, 120)]
    public int ShutdownTimeoutSeconds { get; init; } = 20;

    [Range(1, 300)]
    public int RestartDelaySeconds { get; init; } = 5;

    [Required]
    public EngineOptionsGroup Engines { get; init; } = new();

    public string ResolveDataRoot(string contentRoot) =>
        Path.GetFullPath(Path.IsPathRooted(DataRoot) ? DataRoot : Path.Combine(contentRoot, DataRoot));
}

public sealed class EngineOptionsGroup
{
    public EngineOptions Movie { get; init; } = new();

    public EngineOptions Television { get; init; } = new();

    public EngineOptions For(EngineDomain domain) => domain switch
    {
        EngineDomain.Movie => Movie,
        EngineDomain.Television => Television,
        _ => throw new ArgumentOutOfRangeException(nameof(domain), domain, null)
    };
}

public sealed class EngineOptions
{
    public bool Enabled { get; init; }

    [Required]
    public string ExecutablePath { get; init; } = string.Empty;

    public string Arguments { get; init; } = string.Empty;

    [Required]
    public string HealthPath { get; init; } = "/ping";
}
