using VynodeArr.Gateway.Configuration;

namespace VynodeArr.Gateway.Tests;

public sealed class UnifiedOptionsTests
{
    [Fact]
    public void ResolveDataRootExpandsEnvironmentVariables()
    {
        const string variableName = "VYNODEARR_TEST_DATA_ROOT";
        var expectedRoot = Path.Combine(Path.GetTempPath(), $"vynodearr-options-{Guid.NewGuid():N}");
        var originalValue = Environment.GetEnvironmentVariable(variableName);

        try
        {
            Environment.SetEnvironmentVariable(variableName, expectedRoot);
            var options = new UnifiedOptions
            {
                DataRoot = $"%{variableName}%\\state",
            };

            Assert.Equal(
                Path.GetFullPath(Path.Combine(expectedRoot, "state")),
                options.ResolveDataRoot(Path.GetTempPath()));
        }
        finally
        {
            Environment.SetEnvironmentVariable(variableName, originalValue);
        }
    }
}
