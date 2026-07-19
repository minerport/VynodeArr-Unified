using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using VynodeArr.Gateway;
using VynodeArr.Gateway.Configuration;
using VynodeArr.Gateway.Proxy;
using VynodeArr.Gateway.Runtime;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddOptions<UnifiedOptions>()
    .Bind(builder.Configuration.GetSection(UnifiedOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddWindowsService(options => options.ServiceName = "VynodeArr");
builder.Services.AddSystemd();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IPortAllocator, LoopbackPortAllocator>();
builder.Services.AddSingleton<IEngineProcessFactory, EngineProcessFactory>();
builder.Services.AddSingleton<IEngineApiKeyProvider, XmlEngineApiKeyProvider>();
builder.Services.AddHttpClient<IEngineShutdownClient, HttpEngineShutdownClient>();
builder.Services.AddHttpClient<IEngineReadinessProbe, HttpEngineReadinessProbe>()
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        AllowAutoRedirect = false,
        UseCookies = false
    });
builder.Services.AddSingleton<EngineRegistry>();
builder.Services.AddHttpClient<UnifiedSummaryService>();
builder.Services.AddSingleton<EngineSupervisor>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<EngineSupervisor>());
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddHttpClient(EngineProxy.ClientName)
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        AllowAutoRedirect = false,
        UseCookies = false
    });

var app = builder.Build();
var options = app.Services.GetRequiredService<IOptions<UnifiedOptions>>().Value;
var registry = app.Services.GetRequiredService<EngineRegistry>();

var dataRoot = options.ResolveDataRoot(app.Environment.ContentRootPath);
var unifiedDataRoot = Path.Combine(dataRoot, "unified");
Directory.CreateDirectory(unifiedDataRoot);
FileStream instanceLock;
try
{
    instanceLock = new FileStream(
        Path.Combine(unifiedDataRoot, "gateway.lock"),
        FileMode.OpenOrCreate,
        FileAccess.ReadWrite,
        FileShare.None);
}
catch (IOException exception)
{
    app.Logger.LogCritical(exception, "Another VynodeArr gateway already owns this data root");
    return;
}

await using var heldInstanceLock = instanceLock;

app.MapGet("/health", () => Results.Ok(registry.CreateHealthSnapshot()));
app.UseWebSockets();
app.MapGet("/assets/vynodearr.png", () =>
{
    var stream = typeof(UnifiedShell).Assembly.GetManifestResourceStream("VynodeArr.Branding.png");
    return stream is null
        ? Results.NotFound()
        : Results.Stream(stream, "image/png", enableRangeProcessing: true);
});
app.MapGet("/", () => Results.Content(UnifiedShell.Html, "text/html"));
app.MapGet("/api/unified/v1/engines", () => Results.Ok(registry.CreateHealthSnapshot().Engines));
app.MapGet("/api/unified/v1/summary", (UnifiedSummaryService summary, CancellationToken cancellationToken) =>
    summary.GetAsync(cancellationToken));
app.MapPost("/api/unified/v1/engines/{domain}/{action}", async (
    HttpContext context,
    string domain,
    string action,
    EngineSupervisor supervisor,
    CancellationToken cancellationToken) =>
{
    if (!LifecycleRequestAuthorizer.IsAuthorized(context, options) ||
        !EngineDomainExtensions.TryParseKey(domain, out var engineDomain))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    var enabled = action.ToLowerInvariant() switch
    {
        "start" => true,
        "stop" => false,
        _ => (bool?)null
    };
    if (enabled is null)
    {
        return Results.NotFound();
    }

    await supervisor.SetDomainEnabledAsync(engineDomain, enabled.Value, cancellationToken);
    return Results.Accepted(value: new { domain = engineDomain.Key(), requestedState = enabled.Value ? "running" : "stopped" });
});
app.MapPost("/api/unified/v1/shutdown", async (
    HttpContext context,
    EngineSupervisor supervisor,
    IHostApplicationLifetime lifetime) =>
{
    if (!LifecycleRequestAuthorizer.IsAuthorized(context, options))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    await supervisor.StopAsync(CancellationToken.None);
    lifetime.StopApplication();
    return Results.Accepted();
});
app.MapEngineProxy("movies", EngineDomain.Movie);
app.MapEngineProxy("television", EngineDomain.Television);
app.MapNativeEngineProxy("movies", EngineDomain.Movie);
app.MapNativeEngineProxy("television", EngineDomain.Television);

app.Run();

public partial class Program;
