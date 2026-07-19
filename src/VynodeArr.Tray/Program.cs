using System.ComponentModel;
using System.Diagnostics;
using System.Net;

namespace VynodeArr.Tray;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Any((argument) => string.Equals(argument, "--open", StringComparison.OrdinalIgnoreCase)))
        {
            VynodeArrTrayContext.OpenDashboard();
            return;
        }

        using var instance = new Mutex(initiallyOwned: true, "Local\\VynodeArr.Tray", out var createdNew);
        if (!createdNew)
        {
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new VynodeArrTrayContext());
    }
}

internal sealed class VynodeArrTrayContext : ApplicationContext
{
    private static readonly Uri DashboardUri = new("http://127.0.0.1:8686/");
    private readonly HttpClient _client = new() { Timeout = TimeSpan.FromSeconds(5) };
    private readonly ToolStripMenuItem _openItem = new("Open VynodeArr");
    private readonly ToolStripMenuItem _startItem = new("Start VynodeArr");
    private readonly ToolStripMenuItem _shutdownItem = new("Shut down VynodeArr");
    private readonly NotifyIcon _icon;
    private readonly System.Windows.Forms.Timer _statusTimer = new() { Interval = 5000 };

    public VynodeArrTrayContext()
    {
        var menu = new ContextMenuStrip();
        menu.Items.AddRange([
            _openItem,
            new ToolStripSeparator(),
            _startItem,
            _shutdownItem,
            new ToolStripSeparator(),
            new ToolStripMenuItem("Exit tray", null, (_, _) => ExitThread())
        ]);

        _openItem.Click += (_, _) => OpenDashboard();
        _startItem.Click += (_, _) => StartService();
        _shutdownItem.Click += async (_, _) => await ShutdownAsync();

        _icon = new NotifyIcon
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application,
            Text = "VynodeArr",
            ContextMenuStrip = menu,
            Visible = true
        };
        _icon.DoubleClick += (_, _) => OpenDashboard();
        _statusTimer.Tick += async (_, _) => await RefreshStatusAsync();
        _statusTimer.Start();
        _ = RefreshStatusAsync();
    }

    protected override void ExitThreadCore()
    {
        _statusTimer.Stop();
        _statusTimer.Dispose();
        _icon.Visible = false;
        _icon.Dispose();
        _client.Dispose();
        base.ExitThreadCore();
    }

    internal static void OpenDashboard()
    {
        Process.Start(new ProcessStartInfo(DashboardUri.AbsoluteUri) { UseShellExecute = true });
    }

    private static void StartService()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = Path.Combine(Environment.SystemDirectory, "sc.exe"),
                Arguments = "start VynodeArr",
                UseShellExecute = true,
                Verb = "runas",
                WindowStyle = ProcessWindowStyle.Hidden
            });
        }
        catch (Win32Exception exception)
        {
            MessageBox.Show(
                $"VynodeArr could not be started.\n\n{exception.Message}",
                "VynodeArr",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private async Task ShutdownAsync()
    {
        var confirmation = MessageBox.Show(
            "Shut down VynodeArr, including Movies and Television?",
            "VynodeArr",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question,
            MessageBoxDefaultButton.Button2);
        if (confirmation != DialogResult.Yes)
        {
            return;
        }

        _shutdownItem.Enabled = false;
        try
        {
            using var response = await _client.PostAsync(new Uri(DashboardUri, "api/unified/v1/shutdown"), null);
            response.EnsureSuccessStatusCode();
            _icon.ShowBalloonTip(3000, "VynodeArr", "Movies, Television, and the gateway are shutting down.", ToolTipIcon.Info);
        }
        catch (Exception exception)
        {
            MessageBox.Show(
                $"VynodeArr could not be shut down cleanly.\n\n{exception.Message}",
                "VynodeArr",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
        finally
        {
            await RefreshStatusAsync();
        }
    }

    private async Task RefreshStatusAsync()
    {
        try
        {
            using var response = await _client.GetAsync(new Uri(DashboardUri, "health"));
            var running = response.StatusCode == HttpStatusCode.OK;
            _openItem.Enabled = running;
            _shutdownItem.Enabled = running;
            _startItem.Enabled = !running;
            _icon.Text = running ? "VynodeArr - Running" : "VynodeArr - Stopped";
        }
        catch
        {
            _openItem.Enabled = false;
            _shutdownItem.Enabled = false;
            _startItem.Enabled = true;
            _icon.Text = "VynodeArr - Stopped";
        }
    }
}
