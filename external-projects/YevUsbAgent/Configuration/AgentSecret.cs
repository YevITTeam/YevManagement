using System.Security.Cryptography;
using System.Text;

namespace YevUsbAgent;

// DPAPI machine scope: a copied appsettings.json or policy.json is unreadable on any other PC.
// install.ps1 writes the API key in the same "dpapi:" format with the same entropy.
internal static class AgentSecret
{
    private const string Prefix = "dpapi:";
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("YevUsbAgent.v1");

    public static byte[] Protect(byte[] data) => ProtectedData.Protect(data, Entropy, DataProtectionScope.LocalMachine);

    public static byte[] Unprotect(byte[] data) => ProtectedData.Unprotect(data, Entropy, DataProtectionScope.LocalMachine);

    // Plain values from agents before 1.4 are returned as they are.
    public static string Reveal(string value)
    {
        if (!value.StartsWith(Prefix, StringComparison.Ordinal)) return value;
        try { return Encoding.UTF8.GetString(Unprotect(Convert.FromBase64String(value[Prefix.Length..]))); }
        catch (Exception ex) when (ex is CryptographicException or FormatException) { return ""; }
    }
}
