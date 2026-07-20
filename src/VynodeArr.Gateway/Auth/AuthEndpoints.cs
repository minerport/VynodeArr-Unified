using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;

namespace VynodeArr.Gateway.Auth;

public static class AuthEndpoints
{
    private const string GenericLoginError = "Invalid username or password.";

    public static void MapVynodeArrAuth(this WebApplication app)
    {
        app.MapGet("/login", async (HttpContext context, AuthStore store, IAntiforgery antiforgery) =>
        {
            if (context.User.Identity?.IsAuthenticated == true) return Results.Redirect("/");
            var tokens = antiforgery.GetAndStoreTokens(context);
            return Results.Content(AuthPages.Login(tokens.RequestToken!, SafeReturnUrl(context.Request.Query["returnUrl"]), !await store.HasUsersAsync(context.RequestAborted),
                context.Request.Query.ContainsKey("failed") ? GenericLoginError : null), "text/html");
        }).AllowAnonymous();

        app.MapGet("/setup", async (HttpContext context, AuthStore store, IAntiforgery antiforgery) =>
        {
            if (await store.HasUsersAsync(context.RequestAborted)) return Results.NotFound();
            var tokens = antiforgery.GetAndStoreTokens(context);
            return Results.Content(AuthPages.Setup(tokens.RequestToken!, context.Request.Query["error"]), "text/html");
        }).AllowAnonymous();

        app.MapPost("/api/auth/setup", async (HttpContext context, AuthStore store, IAntiforgery antiforgery) =>
        {
            if (await store.HasUsersAsync(context.RequestAborted)) return Results.NotFound();
            if (!await ValidateCsrfAsync(context, antiforgery)) return Results.BadRequest(new { error = "invalid_request" });
            var form = await context.Request.ReadFormAsync(context.RequestAborted);
            var username = form["username"].ToString().Trim();
            var email = form["email"].ToString().Trim();
            var password = form["password"].ToString();
            if (username.Length is < 3 or > 64 || password != form["confirmation"].ToString())
                return Results.Redirect("/setup?error=" + Uri.EscapeDataString("Check the username and matching passwords."));
            var passwordError = PasswordSecurity.Validate(password);
            if (passwordError is not null) return Results.Redirect("/setup?error=" + Uri.EscapeDataString(passwordError));
            var user = await store.CreateFirstAdministratorAsync(username, string.IsNullOrWhiteSpace(email) ? null : email, PasswordSecurity.Hash(password), context.RequestAborted);
            if (user is null) return Results.NotFound();
            await store.AuditAsync(context, "administrator.created", "success", "user", user.Id.ToString());
            return Results.Redirect("/login");
        }).AllowAnonymous();

        app.MapPost("/api/auth/login", async (HttpContext context, AuthStore store, IAntiforgery antiforgery) =>
        {
            if (!await ValidateCsrfAsync(context, antiforgery)) return Results.BadRequest(new { error = "invalid_request" });
            var form = await context.Request.ReadFormAsync(context.RequestAborted);
            var identifier = form["identifier"].ToString();
            var address = AuthStore.ClientAddress(context);
            if (await store.RecentFailuresAsync(identifier, address, context.RequestAborted) >= 5)
            {
                await store.AuditAsync(context, "login.blocked", "failure");
                return Results.StatusCode(StatusCodes.Status429TooManyRequests);
            }
            var user = await store.FindUserAsync(identifier, context.RequestAborted);
            var valid = user is { Enabled: true } && PasswordSecurity.Verify(form["password"].ToString(), user.PasswordHash);
            await store.RecordLoginAsync(identifier, address, valid, context.RequestAborted);
            if (!valid)
            {
                await store.AuditAsync(context, "login.failed", "failure");
                return Results.Redirect("/login?failed=1");
            }
            var session = await store.CreateSessionAsync(user!, context.Request.Headers.UserAgent, address, context.RequestAborted);
            context.Response.Cookies.Append(SessionToken.CookieName, session.Value, CookieOptions(context, session.ExpiresAt));
            context.User = AuthClaims.Create(user!, session.SessionId);
            await store.AuditAsync(context, "login.succeeded", "success", "session", session.SessionId.ToString());
            return Results.Redirect(SafeReturnUrl(form["returnUrl"]) ?? "/");
        }).AllowAnonymous();

        app.MapPost("/api/auth/logout", async (HttpContext context, AuthStore store, IAntiforgery antiforgery) =>
        {
            if (!await ValidateCsrfAsync(context, antiforgery)) return Results.BadRequest(new { error = "invalid_request" });
            if (long.TryParse(context.User.FindFirst("vynodearr_session_id")?.Value, out var id)) await store.RevokeSessionAsync(id, context.RequestAborted);
            await store.AuditAsync(context, "logout", "success");
            context.Response.Cookies.Delete(SessionToken.CookieName, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, Path = "/", Secure = context.Request.IsHttps });
            context.Response.Headers.CacheControl = "no-store";
            return Results.Redirect("/login");
        }).RequireAuthorization(VynodeArrPolicies.Read);

        app.MapGet("/api/auth/session", (HttpContext context, IAntiforgery antiforgery) =>
        {
            if (context.User.Identity?.IsAuthenticated != true) return Results.Ok(new { authenticated = false });
            var tokens = antiforgery.GetAndStoreTokens(context);
            return Results.Ok(new { authenticated = true, username = context.User.Identity.Name, role = context.User.FindFirst(ClaimTypes.Role)?.Value, csrfToken = tokens.RequestToken });
        }).AllowAnonymous();
    }

    public static bool IsApiRequest(HttpRequest request) => request.Path.StartsWithSegments("/api") || request.Headers.Accept.Any(v => v?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true);
    public static string LoginUrl(HttpRequest request) => "/login?returnUrl=" + Uri.EscapeDataString(SafeReturnUrl(request.PathBase + request.Path + request.QueryString) ?? "/");
    public static string? SafeReturnUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        string decoded;
        try { decoded = Uri.UnescapeDataString(value); } catch (UriFormatException) { return null; }
        if (!decoded.StartsWith('/') || decoded.StartsWith("//") || decoded.Contains('\\') || decoded.Any(char.IsControl)) return null;
        return Uri.TryCreate(value, UriKind.Relative, out _) ? value : null;
    }
    private static CookieOptions CookieOptions(HttpContext context, DateTimeOffset expires) => new() { HttpOnly = true, SameSite = SameSiteMode.Lax, Path = "/", Secure = context.Request.IsHttps, Expires = expires, IsEssential = true };
    private static async Task<bool> ValidateCsrfAsync(HttpContext context, IAntiforgery antiforgery) { try { await antiforgery.ValidateRequestAsync(context); return true; } catch (AntiforgeryValidationException) { return false; } }
}
