using System.Net;

namespace Shared.Application.Helper
{
    // Validates IPv4 addresses + subnet relationships, ported from the internal ChangeIP tool's logic
    // (SetIP.cs: IsValidIP/IsSameSubnet/GetNetworkClass). Shared when creating network ranges
    // (IpPrefix) to ensure the entered Gateway/DNS/SubnetMask are valid IPs and the Gateway actually
    // lies in the same subnet as the IP range being generated.
    public static class NetworkHelper
    {
        // Exactly 4 octets, each 0..255 (no whitespace/extra characters allowed).
        public static bool IsValidIpv4(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;

            var parts = value.Trim().Split('.');
            if (parts.Length != 4) return false;

            foreach (var part in parts)
            {
                if (!int.TryParse(part, out var number)) return false;
                if (number < 0 || number > 255) return false;
                // Rejects "01"/" 1"/"+1"... — only accepts the canonical integer format for an octet.
                if (part != number.ToString()) return false;
            }
            return true;
        }

        // The first 3 octets of an IPv4 address (e.g. "10.45.1.20" → "10.45.1"). Returns null if the IP is invalid.
        public static string? GetNetworkClass(string? ip)
        {
            if (!IsValidIpv4(ip)) return null;

            var parts = ip!.Trim().Split('.');
            return $"{parts[0]}.{parts[1]}.{parts[2]}";
        }

        // Pack an IPv4 address ("10.45.1.20") or a 3-octet prefix ("10.45.1") into a single
        // sortable long so lists order by numeric IP value instead of lexicographically
        // (string sort would put "10.45.1.10" before "10.45.1.2"). Missing octets (prefix) are
        // treated as 0; null/blank or malformed input sorts last (long.MaxValue).
        public static long ToSortableKey(string? ip)
        {
            if (string.IsNullOrWhiteSpace(ip)) return long.MaxValue;

            var parts = ip.Trim().Split('.');
            long key = 0;
            for (var i = 0; i < 4; i++)
            {
                long octet = 0;
                if (i < parts.Length)
                {
                    if (!int.TryParse(parts[i], out var number) || number < 0 || number > 255)
                        return long.MaxValue;
                    octet = number;
                }
                key = (key << 8) | octet;
            }
            return key;
        }

        // Whether ip and gateway are in the same subnet according to subnetMask (bitwise AND per octet).
        // Returns false if any parameter is not a valid IPv4 address.
        public static bool IsSameSubnet(string? ip, string? gateway, string? subnetMask)
        {
            if (!IsValidIpv4(ip) || !IsValidIpv4(gateway) || !IsValidIpv4(subnetMask)) return false;

            try
            {
                var ipBytes = IPAddress.Parse(ip!.Trim()).GetAddressBytes();
                var gwBytes = IPAddress.Parse(gateway!.Trim()).GetAddressBytes();
                var maskBytes = IPAddress.Parse(subnetMask!.Trim()).GetAddressBytes();

                for (var i = 0; i < 4; i++)
                {
                    if ((ipBytes[i] & maskBytes[i]) != (gwBytes[i] & maskBytes[i]))
                        return false;
                }
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
