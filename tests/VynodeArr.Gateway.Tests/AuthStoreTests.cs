using VynodeArr.Gateway.Auth;

namespace VynodeArr.Gateway.Tests;

public sealed class AuthStoreTests
{
    [Fact]
    public async Task FirstAdministratorIsAtomicAndSessionsAreRevocable()
    {
        var root = Path.Combine(Path.GetTempPath(), "vynodearr-auth-tests", Guid.NewGuid().ToString("N"));
        try
        {
            var store = new AuthStore(Path.Combine(root, "auth.db"));
            await store.InitializeAsync();
            Assert.False(await store.HasUsersAsync());
            var first = await store.CreateFirstAdministratorAsync("admin", "admin@example.test", PasswordSecurity.Hash("StrongPassword123"), default);
            var duplicate = await store.CreateFirstAdministratorAsync("other", null, PasswordSecurity.Hash("OtherPassword123"), default);
            Assert.NotNull(first);
            Assert.Null(duplicate);
            Assert.True(await store.HasUsersAsync());
            var token = await store.CreateSessionAsync(first!, "test", "127.0.0.1", default);
            var session = await store.ValidateSessionAsync(token.Value, default);
            Assert.Equal("admin", session?.User.Username);
            await store.RevokeSessionAsync(session!.SessionId, default);
            Assert.Null(await store.ValidateSessionAsync(token.Value, default));
            var viewer = await store.CreateUserAsync("viewer", null, PasswordSecurity.Hash("ViewerPassword123"), VynodeArrRoles.Viewer, default);
            Assert.NotNull(viewer);
            Assert.False(await store.UpdateUserAsync(first.Id, VynodeArrRoles.Viewer, true, default));
            Assert.True(await store.UpdateUserAsync(viewer!.Id, VynodeArrRoles.Viewer, false, default));
            Assert.Equal(2, (await store.ListUsersAsync(default)).Count);
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }
}
