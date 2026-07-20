namespace VynodeArr.Gateway.Dashboard;

public enum MediaEngine { Movies, Television }

public sealed record DashboardQueueItem(string Key, MediaEngine Engine, int EngineQueueId, string Title, string? Subtitle, string MediaType, string Status, double? ProgressPercent, long? SizeBytes, long? SizeRemainingBytes, string? TimeRemaining, string? Quality, string? DownloadClient, bool HasWarning, string? WarningMessage, string NativeUrl);
public sealed record DashboardAttentionItem(string Key, MediaEngine Engine, string Severity, string Category, string Title, string Message, DateTimeOffset? OccurredAt, string? NativeUrl);
public sealed record DashboardModule<T>(bool Available, T? Data, DashboardError? Error);
public sealed record DashboardError(string Code, string Message);
public sealed record DashboardEnvelope<T>(DateTimeOffset GeneratedAt, DashboardModule<T> Movies, DashboardModule<T> Television);

public interface IMoviesDashboardClient { Task<DashboardModule<IReadOnlyList<DashboardQueueItem>>> GetQueueAsync(int limit, CancellationToken cancellationToken); }
public interface ITelevisionDashboardClient { Task<DashboardModule<IReadOnlyList<DashboardQueueItem>>> GetQueueAsync(int limit, CancellationToken cancellationToken); }
