using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security;
using System.Text;

namespace YevUsbAgent;

// The service runs as SYSTEM in session 0; the person at the keyboard is the active console session.
internal static class UserSession
{
    private const uint NoSession = 0xFFFFFFFF;
    private const int WtsUserName = 5;
    private const int WtsDomainName = 7;
    private const uint CreateUnicodeEnvironment = 0x00000400;
    private const uint CreateNoWindow = 0x08000000;

    private static readonly string PowerShell =
        Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");

    // A registered AppUserModelId lets an unpackaged process raise a normal Windows toast (bottom-right).
    private const string ToastScript = """
        $id = 'YEV.UsbAgent'
        $k = "HKCU:\Software\Classes\AppUserModelId\$id"
        if (-not (Test-Path $k)) { New-Item $k -Force | Out-Null }
        New-ItemProperty $k -Name DisplayName -Value 'YEV - Quản lý USB' -Force | Out-Null
        $null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
        $null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
        $x = New-Object Windows.Data.Xml.Dom.XmlDocument
        $x.LoadXml('<toast><visual><binding template="ToastGeneric"><text>__TITLE__</text><text>__MESSAGE__</text></binding></visual></toast>')
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($x))
        """;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        public int cb;
        public string? lpReserved;
        public string? lpDesktop;
        public string? lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        public IntPtr hProcess, hThread;
        public int dwProcessId, dwThreadId;
    }

    [DllImport("kernel32.dll")]
    private static extern uint WTSGetActiveConsoleSessionId();

    [DllImport("wtsapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool WTSQuerySessionInformationW(IntPtr server, uint sessionId, int infoClass, out IntPtr buffer, out uint bytes);

    [DllImport("wtsapi32.dll")]
    private static extern void WTSFreeMemory(IntPtr memory);

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSQueryUserToken(uint sessionId, out IntPtr token);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool CreateEnvironmentBlock(out IntPtr environment, IntPtr token, bool inherit);

    [DllImport("userenv.dll")]
    private static extern bool DestroyEnvironmentBlock(IntPtr environment);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcessAsUserW(IntPtr token, string? application, StringBuilder commandLine, IntPtr processAttributes,
        IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string? directory, ref StartupInfo startupInfo,
        out ProcessInformation processInformation);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    // "DOMAIN\user" of the console session, or null on the logon screen.
    public static string? GetConsoleUser()
    {
        var session = WTSGetActiveConsoleSessionId();
        if (session == NoSession) return null;

        var user = Query(session, WtsUserName);
        if (string.IsNullOrEmpty(user)) return null;

        var domain = Query(session, WtsDomainName);
        return string.IsNullOrEmpty(domain) ? user : $"{domain}\\{user}";
    }

    private static string? Query(uint session, int infoClass)
    {
        if (!WTSQuerySessionInformationW(IntPtr.Zero, session, infoClass, out var buffer, out _)) return null;
        try { return Marshal.PtrToStringUni(buffer); }
        finally { WTSFreeMemory(buffer); }
    }

    // Fire and forget; a missing toast must never block the USB check.
    public static void ShowToast(string title, string message, ILogger logger)
    {
        var script = ToastScript
            .Replace("__TITLE__", SecurityElement.Escape(title))
            .Replace("__MESSAGE__", SecurityElement.Escape(message));
        var arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand "
                        + Convert.ToBase64String(Encoding.Unicode.GetBytes(script));

        try
        {
            // Not SYSTEM ("--run" while debugging): the current user is the one at the screen.
            if (!StartInConsoleSession($"\"{PowerShell}\" {arguments}") && Environment.UserInteractive)
                Process.Start(new ProcessStartInfo(PowerShell, arguments) { CreateNoWindow = true, UseShellExecute = false })?.Dispose();
        }
        catch (Exception ex)
        {
            logger.LogWarning("Could not show the toast: {Message}", ex.Message);
        }
    }

    private static bool StartInConsoleSession(string commandLine)
    {
        var session = WTSGetActiveConsoleSessionId();
        if (session == NoSession || !WTSQueryUserToken(session, out var token)) return false;

        var environment = IntPtr.Zero;
        try
        {
            CreateEnvironmentBlock(out environment, token, false);
            var startup = new StartupInfo { cb = Marshal.SizeOf<StartupInfo>(), lpDesktop = @"winsta0\default" };
            if (!CreateProcessAsUserW(token, null, new StringBuilder(commandLine), IntPtr.Zero, IntPtr.Zero, false,
                    CreateUnicodeEnvironment | CreateNoWindow, environment, null, ref startup, out var info))
                return false;

            CloseHandle(info.hThread);
            CloseHandle(info.hProcess);
            return true;
        }
        finally
        {
            if (environment != IntPtr.Zero) DestroyEnvironmentBlock(environment);
            CloseHandle(token);
        }
    }
}
