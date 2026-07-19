using VynodeArr.Gateway.Configuration;

namespace VynodeArr.Gateway.Runtime;

public interface IEngineReadinessProbe
{
    Task WaitUntilReadyAsync(
        EngineDomain domain,
        EngineOptions settings,
        IEngineProcess process,
        int port,
        TimeSpan timeout,
        CancellationToken cancellationToken);
}

public sealed class HttpEngineReadinessProbe(HttpClient client) : IEngineReadinessProbe
{
    public async Task WaitUntilReadyAsync(
        EngineDomain domain,
        EngineOptions settings,
        IEngineProcess process,
        int port,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutSource.CancelAfter(timeout);
        var healthPath = settings.HealthPath.StartsWith('/')
            ? settings.HealthPath
            : $"/{settings.HealthPath}";
        var endpoint = new Uri($"http://127.0.0.1:{port}{healthPath}", UriKind.Absolute);
        Exception? lastError = null;

        while (!timeoutSource.IsCancellationRequested)
        {
            if (process.HasExited)
            {
                throw new InvalidOperationException(
                    $"The {domain.Key()} engine exited before becoming ready.",
                    lastError);
            }

            try
            {
                using var response = await client.GetAsync(endpoint, timeoutSource.Token);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }

                lastError = new HttpRequestException(
                    $"Readiness endpoint returned HTTP {(int)response.StatusCode}.");
            }
            catch (HttpRequestException exception)
            {
                lastError = exception;
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                break;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(250), timeoutSource.Token)
                .ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
        }

        cancellationToken.ThrowIfCancellationRequested();
        throw new TimeoutException(
            $"The {domain.Key()} engine did not become ready at {endpoint} within {timeout}.",
            lastError);
    }
}
