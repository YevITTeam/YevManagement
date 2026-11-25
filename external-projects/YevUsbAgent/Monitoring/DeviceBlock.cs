using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

namespace YevUsbAgent;

// Blocks a whole disk: volumes forced offline, then the disk device disabled in Windows. Windows remembers a disabled
// device per instance, so re-plugging the same stick stays blocked even before the agent starts. Nothing is deleted.
internal static class DeviceBlock
{
    private const uint GenericRead = 0x80000000;
    private const uint GenericWrite = 0x40000000;
    private const uint ShareReadWrite = 0x3;
    private const uint OpenExisting = 3;
    private const uint FsctlLockVolume = 0x00090018;
    private const uint FsctlDismountVolume = 0x00090020;
    private const uint IoctlVolumeOnline = 0x0056C008;
    private const uint IoctlVolumeOffline = 0x0056C00C;
    private const int ProblemDisabled = 22;
    private const int ConfigFlagDisabled = 0x1;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DeviceIoControl(SafeFileHandle device, uint code, IntPtr inBuffer, uint inSize, IntPtr outBuffer, uint outSize, out uint returned, IntPtr overlapped);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern int CM_Locate_DevNodeW(out uint devInst, string deviceId, uint flags);

    [DllImport("cfgmgr32.dll")]
    private static extern int CM_Get_DevNode_Status(out uint status, out uint problem, uint devInst, uint flags);

    // Locating with flags 0 fails for phantoms, i.e. devices that are not plugged in.
    public static bool IsPresent(string pnpId) => CM_Locate_DevNodeW(out _, pnpId, 0) == 0;

    public static bool IsDisabled(string pnpId)
        => CM_Locate_DevNodeW(out var node, pnpId, 0) == 0
           && CM_Get_DevNode_Status(out _, out var problem, node, 0) == 0
           && problem == ProblemDisabled;

    // Without force, a volume with open files defers the block rather than cutting those files off mid-write.
    public static LockOutcome Disable(string pnpId, IReadOnlyList<string> letters, bool force, ILogger logger)
    {
        var volumes = new List<SafeFileHandle>();
        try
        {
            foreach (var letter in letters)
            {
                var volume = CreateFileW(@"\\.\" + letter.TrimEnd('\\'), GenericRead | GenericWrite, ShareReadWrite, IntPtr.Zero, OpenExisting, 0, IntPtr.Zero);
                if (volume.IsInvalid)
                {
                    volume.Dispose();
                    continue;
                }
                volumes.Add(volume);
                if (!Ioctl(volume, FsctlLockVolume) && !force) return LockOutcome.Deferred;
            }

            foreach (var volume in volumes)
            {
                Ioctl(volume, FsctlDismountVolume);
                Ioctl(volume, IoctlVolumeOffline);
            }
        }
        finally
        {
            foreach (var volume in volumes) volume.Dispose();
        }

        if (RunPnpUtil("/disable-device", pnpId, logger))
            for (var i = 0; i < 10; i++)
            {
                if (IsDisabled(pnpId)) return LockOutcome.Done;
                Thread.Sleep(300);
            }

        // A disable Windows postponed to the next reboot would surprise everyone; cancel it and give the volumes back.
        logger.LogWarning("Could not disable disk {PnpId}.", pnpId);
        Enable(pnpId, logger);
        foreach (var letter in letters) Online(letter);
        return LockOutcome.Failed;
    }

    // Also clears the remembered disabled flag in the registry, which pnputil cannot reach while the device is unplugged.
    public static void Enable(string pnpId, ILogger logger)
    {
        if (IsPresent(pnpId)) RunPnpUtil("/enable-device", pnpId, logger);
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey($@"SYSTEM\CurrentControlSet\Enum\{pnpId}", writable: true);
            if (key?.GetValue("ConfigFlags") is int flags && (flags & ConfigFlagDisabled) != 0)
                key.SetValue("ConfigFlags", flags & ~ConfigFlagDisabled, RegistryValueKind.DWord);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or System.Security.SecurityException or IOException)
        {
            logger.LogWarning("Could not clear the disabled flag of {PnpId}: {Message}", pnpId, ex.Message);
        }
    }

    private static void Online(string letter)
    {
        using var volume = CreateFileW(@"\\.\" + letter.TrimEnd('\\'), GenericRead | GenericWrite, ShareReadWrite, IntPtr.Zero, OpenExisting, 0, IntPtr.Zero);
        if (!volume.IsInvalid) Ioctl(volume, IoctlVolumeOnline);
    }

    private static bool Ioctl(SafeFileHandle handle, uint code)
        => DeviceIoControl(handle, code, IntPtr.Zero, 0, IntPtr.Zero, 0, out _, IntPtr.Zero);

    private static bool RunPnpUtil(string action, string pnpId, ILogger logger)
    {
        var psi = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "pnputil.exe"))
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true
        };
        psi.ArgumentList.Add(action);
        psi.ArgumentList.Add(pnpId);
        try
        {
            using var process = Process.Start(psi)!;
            var output = process.StandardOutput.ReadToEnd();
            if (!process.WaitForExit(30_000))
            {
                process.Kill();
                return false;
            }
            if (process.ExitCode == 0) return true;
            logger.LogWarning("pnputil {Action} {PnpId} exited {Code}: {Output}", action, pnpId, process.ExitCode, output.Trim());
            return false;
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
            logger.LogWarning("pnputil unavailable: {Message}", ex.Message);
            return false;
        }
    }
}
