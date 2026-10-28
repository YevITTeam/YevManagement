using System.Runtime.InteropServices;
using System.Text;

namespace YevUsbAgent;

// Finds the USB device node above a disk in the PnP tree. The disk's own interface type is unreliable:
// UASP enclosures report SCSI, so "is USB" is decided by having a USB ancestor instead.
internal static class UsbTopology
{
    private const int MaxDepth = 12;

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern int CM_Locate_DevNodeW(out uint devInst, string deviceId, uint flags);

    [DllImport("cfgmgr32.dll")]
    private static extern int CM_Get_Parent(out uint parent, uint devInst, uint flags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern int CM_Get_Device_IDW(uint devInst, StringBuilder buffer, int bufferLen, uint flags);

    // Returns the instance id of the nearest "USB\VID_xxxx&PID_xxxx\<serial>" ancestor, or null when the
    // disk is not USB-attached. Composite interface nodes ("&MI_") are skipped in favour of their parent.
    public static string? FindUsbAncestor(string diskPnpId)
    {
        if (CM_Locate_DevNodeW(out var node, diskPnpId, 0) != 0) return null;

        var buffer = new StringBuilder(260);
        for (var depth = 0; depth < MaxDepth; depth++)
        {
            if (CM_Get_Parent(out var parent, node, 0) != 0) return null;
            node = parent;

            buffer.Clear();
            if (CM_Get_Device_IDW(node, buffer, buffer.Capacity, 0) != 0) return null;

            var id = buffer.ToString();
            if (id.StartsWith("USB\\VID_", StringComparison.OrdinalIgnoreCase)
                && !id.Contains("&MI_", StringComparison.OrdinalIgnoreCase))
                return id;
        }
        return null;
    }
}
