using System.Net;

namespace Shared.Application.Helper
{
    // Kiểm tra hợp lệ IPv4 + quan hệ subnet, port từ logic của công cụ ChangeIP nội bộ
    // (SetIP.cs: IsValidIP/IsSameSubnet/GetNetworkClass). Dùng chung khi tạo dải mạng
    // (IpPrefix) để đảm bảo Gateway/DNS/SubnetMask nhập vào là IP hợp lệ và Gateway thực sự
    // nằm cùng subnet với dải IP sẽ sinh ra.
    public static class NetworkHelper
    {
        // Đúng 4 octet, mỗi octet 0..255 (không chấp nhận khoảng trắng/ký tự thừa).
        public static bool IsValidIpv4(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;

            var parts = value.Trim().Split('.');
            if (parts.Length != 4) return false;

            foreach (var part in parts)
            {
                if (!int.TryParse(part, out var number)) return false;
                if (number < 0 || number > 255) return false;
                // Chặn "01"/" 1"/"+1"... — chỉ nhận đúng dạng số nguyên chuẩn của octet.
                if (part != number.ToString()) return false;
            }
            return true;
        }

        // 3 octet đầu của 1 IPv4 (VD "10.45.1.20" → "10.45.1"). Trả về null nếu IP không hợp lệ.
        public static string? GetNetworkClass(string? ip)
        {
            if (!IsValidIpv4(ip)) return null;

            var parts = ip!.Trim().Split('.');
            return $"{parts[0]}.{parts[1]}.{parts[2]}";
        }

        // ip và gateway có cùng subnet theo subnetMask hay không (bitwise AND từng octet).
        // Trả về false nếu bất kỳ tham số nào không phải IPv4 hợp lệ.
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
