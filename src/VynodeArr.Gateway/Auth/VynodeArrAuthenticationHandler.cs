using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace VynodeArr.Gateway.Auth;

public sealed class VynodeArrAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    AuthStore store) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "VynodeArrSession";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Cookies.TryGetValue(SessionToken.CookieName, out var token)) return AuthenticateResult.NoResult();
        var session = await store.ValidateSessionAsync(token, Context.RequestAborted);
        if (session is null) return AuthenticateResult.Fail("Session is invalid or expired.");
        return AuthenticateResult.Success(new AuthenticationTicket(AuthClaims.Create(session.User, session.SessionId), SchemeName));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        if (AuthEndpoints.IsApiRequest(Request)) Response.StatusCode = StatusCodes.Status401Unauthorized;
        else Response.Redirect(AuthEndpoints.LoginUrl(Request));
        return Task.CompletedTask;
    }

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }
}
