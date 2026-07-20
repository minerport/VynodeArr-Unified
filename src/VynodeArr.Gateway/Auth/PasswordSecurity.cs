using System.Security.Cryptography;

namespace VynodeArr.Gateway.Auth;

public static class PasswordSecurity
{
    private const int Iterations = 600_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"pbkdf2-sha256$1${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string encoded)
    {
        var parts = encoded.Split('$');
        if (parts.Length != 5 || parts[0] != "pbkdf2-sha256" || parts[1] != "1" ||
            !int.TryParse(parts[2], out var iterations) || iterations < 100_000)
        {
            return false;
        }

        try
        {
            var salt = Convert.FromBase64String(parts[3]);
            var expected = Convert.FromBase64String(parts[4]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    public static string? Validate(string password)
    {
        if (password.Length < 12) return "Password must be at least 12 characters.";
        if (!password.Any(char.IsLower) || !password.Any(char.IsUpper) || !password.Any(char.IsDigit))
            return "Password must contain uppercase, lowercase, and numeric characters.";
        return null;
    }
}
