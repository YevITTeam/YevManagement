using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace YevUsbAgent;

// USB-to-SATA/NVMe enclosures (e.g. Realtek RTL9210) often report the bridge chip's serial, the same for every unit
// of the model, so approving one would approve them all. For such serials this asks the drive inside for its own
// serial: ATA IDENTIFY through SAT, then Realtek's vendor command wrapping NVMe Identify Controller.
internal static class BridgedSerial
{
    public sealed record InnerDrive(string Serial, string Model);

    private const int MaxAttempts = 3;
    private const uint GenericRead = 0x80000000;
    private const uint GenericWrite = 0x40000000;
    private const uint ShareReadWrite = 0x3;
    private const uint OpenExisting = 3;
    private const uint IoctlScsiPassThrough = 0x4D004;

    private static readonly Dictionary<string, (InnerDrive? Result, int Attempts)> Cache = new(StringComparer.OrdinalIgnoreCase);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DeviceIoControl(SafeFileHandle device, uint code, byte[] inBuffer, int inSize, byte[] outBuffer, int outSize, out int returned, IntPtr overlapped);

    // Empty, one repeated character, or a counting sequence ("0123456789…", "MSFT30" + one when Windows made it up).
    public static bool IsGeneric(string? serial)
    {
        var s = (serial ?? "").Trim().ToUpperInvariant();
        if (s.StartsWith("MSFT30", StringComparison.Ordinal)) s = s[6..];
        if (s.Length < 4 || s.All(c => c == s[0])) return true;
        return s.StartsWith("01234567", StringComparison.Ordinal) || s.StartsWith("12345678", StringComparison.Ordinal);
    }

    // Cached per disk while it stays plugged in; a drive that refuses is asked at most MaxAttempts times.
    public static InnerDrive? Get(string diskPnpId, uint diskIndex, string? model)
    {
        if (Cache.TryGetValue(diskPnpId, out var cached) && (cached.Result != null || cached.Attempts >= MaxAttempts))
            return cached.Result;

        var result = Query(diskIndex, (model ?? "") + " " + diskPnpId);
        Cache[diskPnpId] = (result, cached.Attempts + 1);
        return result;
    }

    // Another enclosure plugged into the same port later must not inherit the cached serial.
    public static void ForgetAllExcept(IEnumerable<string> presentPnpIds)
    {
        var keep = presentPnpIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var key in Cache.Keys.Where(k => !keep.Contains(k)).ToList()) Cache.Remove(key);
    }

    private static InnerDrive? Query(uint diskIndex, string hint)
    {
        using var handle = CreateFileW($@"\\.\PhysicalDrive{diskIndex}", GenericRead | GenericWrite, ShareReadWrite, IntPtr.Zero, OpenExisting, 0, IntPtr.Zero);
        if (handle.IsInvalid) return null;

        // ATA PASS-THROUGH(12) IDENTIFY DEVICE: serial in words 10-19, model in 27-46, bytes swapped per word.
        var ata = ScsiRead(handle, new byte[] { 0xA1, 0x08, 0x0E, 0, 1, 0, 0, 0, 0, 0xEC, 0, 0 }, 512);
        if (ata != null && Validate(AtaString(ata, 20, 20), AtaString(ata, 54, 40)) is { } fromAta) return fromAta;

        if (!hint.Contains("Realtek", StringComparison.OrdinalIgnoreCase) && !hint.Contains("RTL9", StringComparison.OrdinalIgnoreCase))
            return null;

        // Realtek RTL92xx vendor command 0xE4 wrapping NVMe Identify Controller (opcode 0x06, CNS 1), 4096 bytes.
        var cdb = new byte[16];
        cdb[0] = 0xE4;
        cdb[2] = 0x10;
        cdb[3] = 0x06;
        cdb[4] = 0x01;
        var nvme = ScsiRead(handle, cdb, 4096);
        return nvme == null ? null : Validate(Encoding.ASCII.GetString(nvme, 4, 20), Encoding.ASCII.GetString(nvme, 24, 40));
    }

    private static InnerDrive? Validate(string serial, string model)
    {
        serial = new string(serial.Where(c => c > 32 && c < 127).ToArray()).ToUpperInvariant();
        model = new string(model.Where(c => c >= 32 && c < 127).ToArray()).Trim();
        return IsGeneric(serial) ? null : new InnerDrive(serial, model);
    }

    private static string AtaString(byte[] data, int offset, int length)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i += 2)
        {
            chars[i] = (char)data[offset + i + 1];
            chars[i + 1] = (char)data[offset + i];
        }
        return new string(chars);
    }

    // SCSI_PASS_THROUGH (56 bytes on x64) + 32 bytes sense + data. Null when the bridge rejects the command.
    private static byte[]? ScsiRead(SafeFileHandle handle, byte[] cdb, int dataLength)
    {
        const int headerSize = 56, senseSize = 32, dataOffset = headerSize + senseSize;
        var buffer = new byte[dataOffset + dataLength];
        BitConverter.GetBytes((ushort)headerSize).CopyTo(buffer, 0);
        buffer[6] = (byte)cdb.Length;
        buffer[7] = senseSize;
        buffer[8] = 1; // SCSI_IOCTL_DATA_IN
        BitConverter.GetBytes((uint)dataLength).CopyTo(buffer, 12);
        BitConverter.GetBytes(5u).CopyTo(buffer, 16); // timeout, seconds
        BitConverter.GetBytes((ulong)dataOffset).CopyTo(buffer, 24);
        BitConverter.GetBytes((uint)headerSize).CopyTo(buffer, 32);
        Array.Copy(cdb, 0, buffer, 36, cdb.Length);

        if (!DeviceIoControl(handle, IoctlScsiPassThrough, buffer, buffer.Length, buffer, buffer.Length, out _, IntPtr.Zero)) return null;
        if (buffer[2] != 0) return null; // ScsiStatus not GOOD

        var data = new byte[dataLength];
        Array.Copy(buffer, dataOffset, data, 0, dataLength);
        return data;
    }
}
