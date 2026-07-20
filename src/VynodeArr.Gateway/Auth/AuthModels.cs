using System.Security.Claims;

namespace VynodeArr.Gateway.Auth;

public static class VynodeArrRoles
{
    public const string Administrator = "Administrator";
    public const string Viewer = "Viewer";
}

public static class VynodeArrPolicies
{
    public const string Read = "VynodeArr.Read";
    public const string Administer = "VynodeArr.Administer";
}

public sealed record AuthUser(long Id, string Username, string? Email, string PasswordHash, string Role, bool Enabled);

public sealed record AuthenticatedSession(long SessionId, AuthUser User);

public sealed record SessionToken(long SessionId, string Secret, DateTimeOffset ExpiresAt)
{
    public const string CookieName = "vynodearr_session";
    public string Value => $"ses_{SessionId}.{Secret}";
}

public static class AuthClaims
{
    public static ClaimsPrincipal Create(AuthUser user, long sessionId) => new(
        new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("vynodearr_session_id", sessionId.ToString())
        ], VynodeArrAuthenticationHandler.SchemeName));
}
