using VynodeArr.Gateway.Auth;

namespace VynodeArr.Gateway.Tests;

public sealed class PasswordSecurityTests
{
    [Fact]
    public void HashesWithUniqueSaltAndVerifiesInConstantTimeFormat()
    {
        const string password = "Correct-Horse-9-Battery";
        var first = PasswordSecurity.Hash(password);
        var second = PasswordSecurity.Hash(password);
        Assert.NotEqual(first, second);
        Assert.True(PasswordSecurity.Verify(password, first));
        Assert.False(PasswordSecurity.Verify("incorrect-password", first));
        Assert.StartsWith("pbkdf2-sha256$1$600000$", first);
    }

    [Theory]
    [InlineData("short", false)]
    [InlineData("alllowercase12345", false)]
    [InlineData("NoDigitsAnywhere", false)]
    [InlineData("StrongPassword123", true)]
    public void EnforcesPasswordStrength(string password, bool valid) =>
        Assert.Equal(valid, PasswordSecurity.Validate(password) is null);
}
