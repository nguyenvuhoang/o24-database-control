using System.Diagnostics;
using System.Net.Http.Headers;
using Microsoft.Extensions.Hosting.WindowsServices;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options => options.ServiceName = "O24 Database Monitoring Agent");
builder.Services.AddHttpClient("monitor", client => client.Timeout = TimeSpan.FromSeconds(25));
builder.Services.AddHostedService<MonitoringWorker>();
await builder.Build().RunAsync();

public sealed class MonitoringWorker : BackgroundService
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _clients;
    private readonly ILogger<MonitoringWorker> _logger;

    public MonitoringWorker(IConfiguration config, IHttpClientFactory clients, ILogger<MonitoringWorker> logger)
    {
        _config = config;
        _clients = clients;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        var seconds = Math.Clamp(_config.GetValue("Monitor:IntervalSeconds", 60), 30, 3600);
        while (!cancellationToken.IsCancellationRequested)
        {
            try { await CollectAndPostAsync(cancellationToken); }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { break; }
            catch (Exception ex) { _logger.LogError(ex, "Monitoring cycle failed"); }
            try { await Task.Delay(TimeSpan.FromSeconds(seconds), cancellationToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task CollectAndPostAsync(CancellationToken cancellationToken)
    {
        var endpoint = _config["Monitor:ApiUrl"] ?? throw new InvalidOperationException("ApiUrl missing");
        var token = Environment.GetEnvironmentVariable("O24_MONITOR_AGENT_TOKEN") ?? _config["Monitor:AgentToken"];
        if (string.IsNullOrWhiteSpace(token) || token.Length < 32) throw new InvalidOperationException("Agent token missing or too short");
        var script = Path.Combine(AppContext.BaseDirectory, "collect.ps1");
        var processInfo = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{script}\" -AgentId \"{_config["Monitor:AgentId"]}\" -Instance \"{_config["Monitor:Instance"]}\" -BackupDirectory \"{_config["Monitor:BackupDirectory"]}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        using var proc = Process.Start(processInfo) ?? throw new Exception("PowerShell could not start");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(45));
        var stdoutTask = proc.StandardOutput.ReadToEndAsync(timeout.Token);
        var stderrTask = proc.StandardError.ReadToEndAsync(timeout.Token);
        try { await proc.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException)
        {
            if (!proc.HasExited) proc.Kill(entireProcessTree: true);
            throw;
        }
        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        if (proc.ExitCode != 0) throw new Exception($"Collector exited {proc.ExitCode}: {stderr}");
        using var json = System.Text.Json.JsonDocument.Parse(stdout);
        var client = _clients.CreateClient("monitor");
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent(stdout, System.Text.Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
        _logger.LogInformation("Telemetry delivered to {Endpoint}", endpoint);
    }
}
