namespace VynodeArr.Gateway.Runtime;

public enum EngineDomain
{
    Movie,
    Television
}

public static class EngineDomainExtensions
{
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
