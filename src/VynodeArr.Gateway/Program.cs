using Microsoft.Extensions.Options;
using System.Text.Json.Serialization;
using VynodeArr.Gateway.Configuration;
using VynodeArr.Gateway.Proxy;
using VynodeArr.Gateway.Runtime;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddOptions<UnifiedOptions>()
    .Bind(builder.Configuration.GetSection(UnifiedOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IPortAllocator, LoopbackPortAllocator>();
builder.Services.AddSingleton<IEngineProcessFactory, EngineProcessFactory>();
builder.Services.AddSingleton<EngineRegistry>();
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
app.MapGet("/api/unified/v1/engines", () => Results.Ok(registry.CreateHealthSnapshot().Engines));
app.MapEngineProxy("movies", EngineDomain.Movie);
app.MapEngineProxy("television", EngineDomain.Television);

app.Run();

public partial class Program;
