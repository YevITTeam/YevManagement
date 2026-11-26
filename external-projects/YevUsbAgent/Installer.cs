using System.ComponentModel;
using System.Diagnostics;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.Json;

namespace YevUsbAgent;

// Entry point when the exe is run by hand (double-click, Tanium) or by the updater instead of by the service manager.
// The exe carries install.ps1, uninstall.ps1 and optionally agent.json as embedded resources, so it ships as one file.
internal static class Installer
{
    private const int WrongPasswordExitCode = 2;

    private static readonly string PowerShell =
        Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");

    public static int Run(string[] args)
    {
        return IsAdministrator() ? RunElevated(args) : Elevate(args);
    }

    internal static int RunElevated(string[] args)
    {
        var uninstall = args.Contains("--uninstall");
        var silent = args.Contains("--silent");
        var installDir = Option(args, "--install-dir") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "YevUsbAgent");
        var dataDir = new AgentOptions().ResolveDataDir();
        // Read before uninstall.ps1 deletes them: the server address to report to and the disks to give back.
        var options = ReadInstalledOptions(installDir);
        var blocked = uninstall ? UsbMonitor.LoadBlocked(UsbMonitor.BlockedPathIn(dataDir)) : new List<BlockedDisk>();

        if (uninstall && !CheckPassword(args, dataDir, silent, options)) return Finish(WrongPasswordExitCode, silent);

        var workDir = Path.Combine(Path.GetTempPath(), "YevUsbAgent-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(workDir);
        int exitCode;
        try
        {
            var script = Extract(uninstall ? "uninstall.ps1" : "install.ps1", workDir, optional: false);
            Extract("agent.json", workDir, optional: true);

            var psi = new ProcessStartInfo(PowerShell) { UseShellExecute = false };
            foreach (var arg in new[] { "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script })
                psi.ArgumentList.Add(arg);

            if (!uninstall)
            {
                psi.ArgumentList.Add("-ExePath");
                psi.ArgumentList.Add(Environment.ProcessPath!);
                Forward(args, psi, "--server-url", "-ServerUrl");
                Forward(args, psi, "--api-key", "-ApiKey");
                if (args.Contains("--self-update"))
                {
                    psi.ArgumentList.Add("-Reason");
                    psi.ArgumentList.Add("self-update");
                }
            }
            if (uninstall && args.Contains("--purge")) psi.ArgumentList.Add("-Purge");
            Forward(args, psi, "--install-dir", "-InstallDir");

            using var process = Process.Start(psi)!;
            process.WaitForExit();
            exitCode = process.ExitCode;
        }
        finally
        {
            try { Directory.Delete(workDir, recursive: true); }
            catch (IOException) { }
        }

        if (uninstall && exitCode == 0)
        {
            // The service is gone, so nothing would ever re-enable the USB sticks it disabled.
            foreach (var disk in blocked) DeviceBlock.Enable(disk.PnpId, Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);
            Report(options, AgentEventTypes.Uninstalled, null);
        }

        return Finish(exitCode, silent);
    }

    private static int Finish(int exitCode, bool silent)
    {
        Console.WriteLine(exitCode switch
        {
            0 => "Xong.",
            WrongPasswordExitCode => "Sai mat khau go agent.",
            _ => $"Loi (ma {exitCode}). Xem %ProgramData%\\YevUsbAgent\\install.log"
        });
        if (!silent && Environment.UserInteractive)
        {
            Console.WriteLine("Nhan Enter de dong.");
            Console.ReadLine();
        }
        return exitCode;
    }

    // The hash comes from the web (UsbAgent settings) through policy.json; no hash = no password set.
    private static bool CheckPassword(string[] args, string dataDir, bool silent, AgentOptions? options)
    {
        var hash = PolicyStore.Load(PolicyStore.PathIn(dataDir))?.UninstallPasswordHash;
        if (string.IsNullOrEmpty(hash)) return true;

        var password = Option(args, "--password");
        if (password == null && !silent && Environment.UserInteractive)
        {
            Console.Write("Mat khau go agent: ");
            password = ReadMasked();
        }

        if (password != null && VerifyPassword(hash, password)) return true;
        Report(options, AgentEventTypes.UninstallDenied, password == null ? "Không nhập mật khẩu" : "Sai mật khẩu");
        return false;
    }

    // Format written by Asset.Application UsbPolicyService.HashPassword: "iterations.saltBase64.hashBase64" (PBKDF2-SHA256).
    internal static bool VerifyPassword(string stored, string password)
    {
        var parts = stored.Split('.');
        if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations)) return false;
        try
        {
            var salt = Convert.FromBase64String(parts[1]);
            var expected = Convert.FromBase64String(parts[2]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException) { return false; }
    }

    private static string ReadMasked()
    {
        var chars = new List<char>();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace) { if (chars.Count > 0) chars.RemoveAt(chars.Count - 1); }
            else if (!char.IsControl(key.KeyChar)) chars.Add(key.KeyChar);
        }
        Console.WriteLine();
        return new string(chars.ToArray());
    }

    private static AgentOptions? ReadInstalledOptions(string installDir)
    {
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(installDir, "appsettings.json")));
            var agent = doc.RootElement.GetProperty("Agent");
            return new AgentOptions
            {
                ServerUrl = agent.GetProperty("ServerUrl").GetString() ?? "",
                ApiKey = AgentSecret.Reveal(agent.GetProperty("ApiKey").GetString() ?? "")
            };
        }
        catch (Exception ex) when (ex is IOException or JsonException or KeyNotFoundException or UnauthorizedAccessException or InvalidOperationException)
        {
            return null;
        }
    }

    // Straight to the server: the service is stopping (uninstall) or must not share its queue file with this process.
    private static void Report(AgentOptions? options, int type, string? detail)
    {
        if (options == null || options.ServerUrl.Length == 0) return;
        try
        {
            using var http = AgentHttp.Create(options, timeoutSeconds: 10);
            var ev = Lifecycle.Event(type, detail, WindowsIdentity.GetCurrent().Name);
            var body = new IngestRequest(Environment.MachineName, new List<AgentEvent> { ev });
            http.PostAsJsonAsync("api/UsbLog/ingest", body, AgentJson.Default.IngestRequest).GetAwaiter().GetResult().Dispose();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException) { }
    }

    // Relaunches this exe with the same arguments and a UAC prompt, then reports the elevated run's exit code.
    private static int Elevate(string[] args)
    {
        try
        {
            var psi = new ProcessStartInfo(Environment.ProcessPath!)
            {
                UseShellExecute = true,
                Verb = "runas",
                Arguments = string.Join(' ', args.Select(Quote))
            };
            using var process = Process.Start(psi)!;
            process.WaitForExit();
            return process.ExitCode;
        }
        catch (Win32Exception)
        {
            Console.WriteLine("Da huy: can quyen Administrator de cai dat.");
            return 1;
        }
    }

    private static bool IsAdministrator()
        => new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);

    private static string Extract(string name, string dir, bool optional)
    {
        using var stream = typeof(Installer).Assembly.GetManifestResourceStream(name);
        if (stream == null)
        {
            if (optional) return "";
            throw new InvalidOperationException($"Embedded resource {name} is missing.");
        }

        var path = Path.Combine(dir, name);
        using var file = File.Create(path);
        stream.CopyTo(file);
        return path;
    }

    private static string? Option(string[] args, string option)
    {
        var index = Array.IndexOf(args, option);
        return index < 0 || index + 1 >= args.Length ? null : args[index + 1];
    }

    private static void Forward(string[] args, ProcessStartInfo psi, string option, string psParameter)
    {
        var value = Option(args, option);
        if (value == null) return;

        psi.ArgumentList.Add(psParameter);
        psi.ArgumentList.Add(value);
    }

    private static string Quote(string arg)
        => arg.Length > 0 && arg.IndexOfAny(new[] { ' ', '"', '\t' }) < 0 ? arg : "\"" + arg.Replace("\"", "\\\"") + "\"";
}
