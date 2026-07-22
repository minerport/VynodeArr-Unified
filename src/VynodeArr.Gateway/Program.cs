using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.Extensions.Options;
using VynodeArr.Gateway;
using VynodeArr.Gateway.Auth;
using VynodeArr.Gateway.Configuration;
using VynodeArr.Gateway.Dashboard;
using VynodeArr.Gateway.Proxy;
using VynodeArr.Gateway.Runtime;

var builder = WebApplication.CreateBuilder(args);

var uiEnvironmentOverrides = new Dictionary<string, string?>();
AddBooleanEnvironmentOverride("VYNODEARR_UI_TOKENS_ENABLED", "VynodeArr:Ui:TokensEnabled");
AddBooleanEnvironmentOverride("VYNODEARR_NEW_SHELL_STYLING_ENABLED", "VynodeArr:Ui:NewShellStylingEnabled");
builder.Configuration.AddInMemoryCollection(uiEnvironmentOverrides);

void AddBooleanEnvironmentOverride(string environmentName, string configurationKey)
{
    var value = Environment.GetEnvironmentVariable(environmentName);
    if (bool.TryParse(value, out var enabled))
    {
        uiEnvironmentOverrides[configurationKey] = enabled.ToString();
    }
}

builder.Services
    .AddOptions<UnifiedOptions>()
    .Bind(builder.Configuration.GetSection(UnifiedOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddWindowsService(options => options.ServiceName = "VynodeArr");
builder.Services.AddSystemd();
builder.Services.AddAntiforgery(options =>
{
    options.Cookie.Name = "vynodearr_csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.HeaderName = "X-VynodeArr-CSRF";
});
builder.Services.AddAuthentication(VynodeArrAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, VynodeArrAuthenticationHandler>(VynodeArrAuthenticationHandler.SchemeName, _ => { });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(VynodeArrPolicies.Read, policy => policy.RequireAuthenticatedUser());
    options.AddPolicy(VynodeArrPolicies.Administer, policy => policy.RequireRole(VynodeArrRoles.Administrator));
});
builder.Services.AddSingleton(provider =>
{
    var configured = provider.GetRequiredService<IOptions<UnifiedOptions>>().Value;
    var environment = provider.GetRequiredService<IHostEnvironment>();
    return new AuthStore(Path.Combine(configured.ResolveDataRoot(environment.ContentRootPath), "unified", "auth.db"));
});

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
builder.Services.AddHttpClient<UnifiedCalendarService>();
builder.Services.AddHttpClient<IMoviesDashboardClient, MoviesDashboardClient>();
builder.Services.AddHttpClient<ITelevisionDashboardClient, TelevisionDashboardClient>();
builder.Services.AddSingleton<DashboardQueueService>();
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
await app.Services.GetRequiredService<AuthStore>().InitializeAsync();

app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    await next();
});
app.UseWebSockets();
app.UseAuthentication();
app.Use(async (context, next) =>
{
    var isPublic = context.Request.Path.StartsWithSegments("/assets") || context.Request.Path == "/health" ||
        context.Request.Path == "/login" || context.Request.Path == "/setup" || context.Request.Path.StartsWithSegments("/api/auth") ||
        AuthEndpoints.IsNativeEngineApiRequest(context.Request);
    if (!isPublic && context.User.Identity?.IsAuthenticated != true && !await context.RequestServices.GetRequiredService<AuthStore>().HasUsersAsync(context.RequestAborted))
    {
        if (AuthEndpoints.IsApiRequest(context.Request)) { context.Response.StatusCode = StatusCodes.Status401Unauthorized; return; }
        context.Response.Redirect("/setup"); return;
    }
    if (!isPublic) context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();
app.MapVynodeArrAuth();
app.MapGet("/assets/vynodearr.png", () =>
{
    var stream = typeof(UnifiedShell).Assembly.GetManifestResourceStream("VynodeArr.Branding.png");
    return stream is null
        ? Results.NotFound()
        : Results.Stream(stream, "image/png", enableRangeProcessing: true);
}).AllowAnonymous();
app.MapGet("/assets/vynodearr-tokens.v1.css", () =>
{
    var stream = typeof(UnifiedShell).Assembly.GetManifestResourceStream("VynodeArr.Assets.VynodeArrTokens.v1.css");
    return stream is null
        ? Results.NotFound()
        : Results.Stream(stream, "text/css; charset=utf-8");
}).AllowAnonymous();
app.MapGet("/assets/vynodearr-native.v1.css", () =>
{
    var stream = typeof(UnifiedShell).Assembly.GetManifestResourceStream("VynodeArr.Assets.VynodeArrNative.v1.css");
    return stream is null
        ? Results.NotFound()
        : Results.Stream(stream, "text/css; charset=utf-8");
}).AllowAnonymous();
app.MapGet("/", () => Results.Content(
    UnifiedShell.Render(options.Ui, typeof(Program).Assembly.GetName().Version?.ToString() ?? "development"),
    "text/html")).RequireAuthorization(VynodeArrPolicies.Read);
app.MapGet("/api/unified/v1/engines", () => Results.Ok(registry.CreateHealthSnapshot().Engines)).RequireAuthorization(VynodeArrPolicies.Read);
app.MapGet("/api/unified/v1/summary", (UnifiedSummaryService summary, CancellationToken cancellationToken) =>
    summary.GetAsync(cancellationToken)).RequireAuthorization(VynodeArrPolicies.Read);
app.MapGet("/api/unified/v1/calendar", (UnifiedCalendarService calendar, CancellationToken cancellationToken) =>
    calendar.GetAsync(cancellationToken)).RequireAuthorization(VynodeArrPolicies.Read);
app.MapGet("/api/dashboard/summary", (UnifiedSummaryService summary, CancellationToken cancellationToken) =>
    summary.GetAsync(cancellationToken)).RequireAuthorization(VynodeArrPolicies.Read);
app.MapGet("/api/dashboard/queue", (DashboardQueueService queue, int? limit, CancellationToken cancellationToken) =>
    queue.GetAsync(Math.Clamp(limit ?? 10, 1, 25), cancellationToken)).RequireAuthorization(VynodeArrPolicies.Read);
app.MapGet("/api/dashboard/agenda", (UnifiedCalendarService calendar, CancellationToken cancellationToken) =>
    calendar.GetUpcomingAsync(cancellationToken)).RequireAuthorization(VynodeArrPolicies.Read);
app.MapGet("/api/dashboard/attention", async (UnifiedSummaryService summary, CancellationToken cancellationToken) =>
{
    var current = await summary.GetAsync(cancellationToken);
    var domains = current.Domains.Values.Select(domain => new
    {
        engine = domain.Domain,
        items = BuildAttention(domain)
    }).ToDictionary(item => item.engine, item => item.items);
    return Results.Ok(new { generatedAt = current.Timestamp, domains });
}).RequireAuthorization(VynodeArrPolicies.Read);
app.MapPost("/api/unified/v1/engines/{domain}/{action}", async (
    HttpContext context,
    string domain,
    string action,
    EngineSupervisor supervisor,
    CancellationToken cancellationToken) =>
{
    if (!EngineDomainExtensions.TryParseKey(domain, out var engineDomain))
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

    if (!await ValidateAntiforgery(context)) return Results.BadRequest(new { error = "invalid_csrf" });
    await supervisor.SetDomainEnabledAsync(engineDomain, enabled.Value, cancellationToken);
    await context.RequestServices.GetRequiredService<AuthStore>().AuditAsync(context, $"engine.{action}", "success", "engine", engineDomain.Key());
    return Results.Accepted(value: new { domain = engineDomain.Key(), requestedState = enabled.Value ? "running" : "stopped" });
}).RequireAuthorization(VynodeArrPolicies.Administer);
app.MapPost("/api/unified/v1/shutdown", async (
    HttpContext context,
    EngineSupervisor supervisor,
    IHostApplicationLifetime lifetime) =>
{
    if (!await ValidateAntiforgery(context)) return Results.BadRequest(new { error = "invalid_csrf" });
    await context.RequestServices.GetRequiredService<AuthStore>().AuditAsync(context, "application.shutdown", "success", "application", "vynodearr");
    await supervisor.StopAsync(CancellationToken.None);
    lifetime.StopApplication();
    return Results.Accepted();
}).RequireAuthorization(VynodeArrPolicies.Administer);
app.MapEngineProxy("movies", EngineDomain.Movie);
app.MapEngineProxy("television", EngineDomain.Television);
app.MapNativeEngineProxy("movies", EngineDomain.Movie);
app.MapNativeEngineProxy("television", EngineDomain.Television);

app.Run();

async Task<bool> ValidateAntiforgery(HttpContext context)
{
    try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); return true; }
    catch (AntiforgeryValidationException) { return false; }
}

IReadOnlyList<DashboardAttentionItem> BuildAttention(DomainSummary domain)
{
    var engine = domain.Domain == "movie" ? MediaEngine.Movies : MediaEngine.Television;
    var link = domain.Domain == "movie" ? "/movies/system/status" : "/television/system/status";
    var items = new List<DashboardAttentionItem>();
    if (domain.Error is not null) items.Add(new($"{domain.Domain}:availability", engine, "Error", "Engine", $"{engine} Engine unavailable", "The engine could not be reached.", null, link));
    if (domain.HealthIssues > 0) items.Add(new($"{domain.Domain}:health", engine, "Warning", "Health", $"{domain.HealthIssues} health issue(s)", "Open the native system page for details.", null, link));
    return items;
}

public partial class Program;
