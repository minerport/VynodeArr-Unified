using System.Net;
using System.Net.Sockets;

namespace VynodeArr.Gateway.Runtime;

public interface IPortAllocator
{
    int Allocate();
}

public sealed class LoopbackPortAllocator : IPortAllocator
{
    public int Allocate()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();

        try
        {
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
        finally
        {
            listener.Stop();
        }
    }
}
