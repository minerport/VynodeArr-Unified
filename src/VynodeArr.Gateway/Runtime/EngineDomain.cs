namespace VynodeArr.Gateway.Runtime;

public enum EngineDomain
{
    Movie,
    Television
}

public static class EngineDomainExtensions
{
    public static bool TryParseKey(string value, out EngineDomain domain)
    {
        domain = value.ToLowerInvariant() switch
        {
            "movie" or "movies" => EngineDomain.Movie,
            "television" or "tv" => EngineDomain.Television,
            _ => default
        };

        return value.Equals("movie", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("movies", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("television", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("tv", StringComparison.OrdinalIgnoreCase);
    }

    public static string Key(this EngineDomain domain) => domain switch
    {
        EngineDomain.Movie => "movie",
        EngineDomain.Television => "television",
        _ => throw new ArgumentOutOfRangeException(nameof(domain), domain, null)
    };

    public static string NativePathBase(this EngineDomain domain) => domain switch
    {
        EngineDomain.Movie => "/movies",
        EngineDomain.Television => "/television",
        _ => throw new ArgumentOutOfRangeException(nameof(domain), domain, null)
    };
}
