using System.ComponentModel;
using System.Diagnostics;
using System.Security.Principal;

namespace YevUsbAgent;

// Entry point when the exe is run by hand (double-click, Tanium) instead of by the service manager. The exe carries
// install.ps1, uninstall.ps1 and optionally agent.json as embedded resources, so the agent ships as one file.
internal static class Installer
{
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

        Console.WriteLine(exitCode == 0 ? "Xong." : $"Loi (ma {exitCode}). Xem %ProgramData%\\YevUsbAgent\\install.log");
        if (!silent && Environment.UserInteractive)
        {
            Console.WriteLine("Nhan Enter de dong.");
            Console.ReadLine();
        }
        return exitCode;
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

    private static void Forward(string[] args, ProcessStartInfo psi, string option, string psParameter)
    {
        var index = Array.IndexOf(args, option);
        if (index < 0 || index + 1 >= args.Length) return;

        psi.ArgumentList.Add(psParameter);
        psi.ArgumentList.Add(args[index + 1]);
    }

    private static string Quote(string arg)
        => arg.Length > 0 && arg.IndexOfAny(new[] { ' ', '"', '\t' }) < 0 ? arg : "\"" + arg.Replace("\"", "\\\"") + "\"";
}
