using System.Net;
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

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IPortAllocator, LoopbackPortAllocator>();
builder.Services.AddSingleton<IEngineProcessFactory, EngineProcessFactory>();
builder.Services.AddSingleton<IEngineApiKeyProvider, XmlEngineApiKeyProvider>();
builder.Services.AddHttpClient<IEngineReadinessProbe, HttpEngineReadinessProbe>()
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        AllowAutoRedirect = false,
        UseCookies = false
    });
builder.Services.AddSingleton<EngineRegistry>();
builder.Services.AddHttpClient<UnifiedSummaryService>();
builder.Services.AddHostedService<EngineSupervisor>();
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

Directory.CreateDirectory(options.ResolveDataRoot(app.Environment.ContentRootPath));

app.MapGet("/health", () => Results.Ok(registry.CreateHealthSnapshot()));
app.UseWebSockets();
app.MapGet("/", () => Results.Content(UnifiedShell.Html, "text/html"));
app.MapGet("/api/unified/v1/engines", () => Results.Ok(registry.CreateHealthSnapshot().Engines));
app.MapGet("/api/unified/v1/summary", (UnifiedSummaryService summary, CancellationToken cancellationToken) =>
    summary.GetAsync(cancellationToken));
app.MapPost("/api/unified/v1/shutdown", (HttpContext context, IHostApplicationLifetime lifetime) =>
{
    if (context.Connection.RemoteIpAddress is not { } remoteAddress || !IPAddress.IsLoopback(remoteAddress))
    {
        return Results.StatusCode(StatusCodes.Status403Forbidden);
    }

    lifetime.StopApplication();
    return Results.Accepted();
});
app.MapEngineProxy("movies", EngineDomain.Movie);
app.MapEngineProxy("television", EngineDomain.Television);
app.MapNativeEngineProxy("movies", EngineDomain.Movie);
app.MapNativeEngineProxy("television", EngineDomain.Television);

app.Run();

public partial class Program;
