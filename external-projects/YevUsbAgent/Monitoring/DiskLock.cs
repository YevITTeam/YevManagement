using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace YevUsbAgent;

internal enum LockOutcome { Done, Unchanged, Deferred, Failed }

// Write-blocks a whole disk with the Windows read-only disk attribute (what Set-Disk -IsReadOnly / diskpart set),
// then remounts its volumes so the file system notices. Nothing on the disk is ever deleted.
internal static class DiskLock
{
    private const uint GenericRead = 0x80000000;
    private const uint GenericWrite = 0x40000000;
    private const uint ShareReadWrite = 0x3;
    private const uint OpenExisting = 3;
    private const uint FsctlLockVolume = 0x00090018;
    private const uint FsctlDismountVolume = 0x00090020;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DeviceIoControl(SafeFileHandle device, uint code, IntPtr inBuffer, uint inSize, IntPtr outBuffer, uint outSize, out uint returned, IntPtr overlapped);

    // Without force, a volume with open files defers the change rather than cutting those files off mid-write.
    public static LockOutcome Apply(uint diskIndex, IReadOnlyList<string> letters, bool readOnly, bool force, ILogger logger)
    {
        // Already in the wanted state (second partition of the same disk, attribute kept from an earlier plug-in).
        if (IsReadOnly(diskIndex) == readOnly) return LockOutcome.Unchanged;

        var volumes = new List<SafeFileHandle>();
        try
        {
            foreach (var letter in letters)
            {
                var volume = OpenVolume(letter);
                if (volume == null) continue;
                volumes.Add(volume);
                if (!Ioctl(volume, FsctlLockVolume) && !force) return LockOutcome.Deferred;
            }

            if (!SetReadOnly(diskIndex, readOnly, logger)) return LockOutcome.Failed;

            foreach (var volume in volumes) Ioctl(volume, FsctlDismountVolume);
            return LockOutcome.Done;
        }
        finally
        {
            foreach (var volume in volumes) volume.Dispose();
        }
    }

    private static SafeFileHandle? OpenVolume(string letter)
    {
        var path = @"\\.\" + letter.TrimEnd('\\');
        foreach (var access in new[] { GenericRead | GenericWrite, GenericRead })
        {
            var handle = CreateFileW(path, access, ShareReadWrite, IntPtr.Zero, OpenExisting, 0, IntPtr.Zero);
            if (!handle.IsInvalid) return handle;
            handle.Dispose();
        }
        return null;
    }

    private static bool Ioctl(SafeFileHandle handle, uint code)
        => DeviceIoControl(handle, code, IntPtr.Zero, 0, IntPtr.Zero, 0, out _, IntPtr.Zero);

    private static bool? IsReadOnly(uint diskIndex)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(@"root\Microsoft\Windows\Storage", $"SELECT IsReadOnly FROM MSFT_Disk WHERE Number = {diskIndex}");
            foreach (ManagementObject disk in searcher.Get())
                using (disk) return disk["IsReadOnly"] as bool?;
        }
        catch (Exception ex) when (ex is ManagementException or COMException) { }
        return null;
    }

    // MSFT_Disk first; diskpart is the fallback because it is the documented way for USB sticks.
    private static bool SetReadOnly(uint diskIndex, bool readOnly, ILogger logger)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(@"root\Microsoft\Windows\Storage", $"SELECT * FROM MSFT_Disk WHERE Number = {diskIndex}");
            foreach (ManagementObject disk in searcher.Get())
            {
                using (disk)
                {
                    using var args = disk.GetMethodParameters("SetAttributes");
                    args["IsReadOnly"] = readOnly;
                    using var result = disk.InvokeMethod("SetAttributes", args, null);
                    var code = Convert.ToUInt32(result["ReturnValue"]);
                    if (code == 0) return true;
                    logger.LogWarning("MSFT_Disk.SetAttributes(IsReadOnly={ReadOnly}) on disk {Disk} returned {Code}; trying diskpart.", readOnly, diskIndex, code);
                }
            }
        }
        catch (Exception ex) when (ex is ManagementException or COMException)
        {
            logger.LogWarning("MSFT_Disk unavailable for disk {Disk} ({Message}); trying diskpart.", diskIndex, ex.Message);
        }

        return RunDiskpart(diskIndex, readOnly, logger);
    }

    private static bool RunDiskpart(uint diskIndex, bool readOnly, ILogger logger)
    {
        var script = Path.Combine(Path.GetTempPath(), $"yevusb-{Guid.NewGuid():N}.txt");
        try
        {
            File.WriteAllText(script, $"select disk {diskIndex}\r\nattributes disk {(readOnly ? "set" : "clear")} readonly\r\n");
            var psi = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "diskpart.exe"), $"/s \"{script}\"")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true
            };
            using var process = Process.Start(psi)!;
            var output = process.StandardOutput.ReadToEnd();
            if (!process.WaitForExit(60_000))
            {
                process.Kill();
                return false;
            }
            if (process.ExitCode == 0) return true;

            logger.LogWarning("diskpart could not change disk {Disk}: {Output}", diskIndex, output.Trim());
            return false;
        }
        finally
        {
            try { File.Delete(script); }
            catch (IOException) { }
        }
    }
}
