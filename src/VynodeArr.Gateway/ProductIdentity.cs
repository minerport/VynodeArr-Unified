using System.Reflection;

namespace VynodeArr.Gateway;

public static class ProductIdentity
{
    public static string Version
    {
        get
        {
            var informationalVersion = typeof(ProductIdentity).Assembly
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
                .InformationalVersion;

            if (!string.IsNullOrWhiteSpace(informationalVersion))
            {
                return informationalVersion.Split('+', 2)[0];
            }

            return typeof(ProductIdentity).Assembly.GetName().Version?.ToString(3) ?? "development";
        }
    }
}
