using System.Security.Cryptography;

namespace Asset.Application.Services
{
    // Releases are signed on upload with the private key in App_Data; the agent embeds this public half (Update/UpdateKey.cs),
    // so a wrong key file is caught here instead of every agent rejecting the update.
    public static class UsbAgentReleaseKey
    {
        private const string PublicKeyXml = "<RSAKeyValue><Modulus>pKssYpHPUdTqCUK+LRSNsfbvIomKrpdkdvwvz39UHHmg8M7c+bNRXnyc/1leNFvIyf2jQ7072f2/WrySmaNGS78SgVcGd0w5VH8vh1aLj3BtQYS/qJsx7rcj/aH99CGWY0b8WAv9ujGYdtHnOMr2v7pYWghUSwT7kKzTXi9MdyBl02cd0j3OilOtU6tC+yCzoo0jpLmdM/uEWsDqIf0SY/PYb20jFtwlx7oRomX1mxbWQIgJgZnQwv31v9yuvib0NvyuyvcIZgLMZ58Df9i1rmXKmvmraeXKdkZVtmucyUUOoZZeaOBP/nJTrS+9c6K0e9AU36r7yqSExZ33sCX51OYou8X2+AJENomTCu2LsxZvRubWGTEHKW5VmhKzWZI1djGzLy8x6UC9og/9Kt7MJaiMWjBp/yDjBgTPKzuxffEbkVd+WICJthbIOxUBst/O5epy48ITM3M6Dm4Afb4O8bWNBKr1xvw8qbiiEDcDpty0e7j8HmaOpfR6fQql2g+t</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>";

        // Null when the private key does not belong to the agents' public key.
        public static string? Sign(byte[] file, string privateKeyXml)
        {
            using var rsa = RSA.Create();
            rsa.FromXmlString(privateKeyXml);
            var signature = Convert.ToBase64String(rsa.SignData(file, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
            return Verify(file, signature) ? signature : null;
        }

        public static bool Verify(byte[] file, string signatureBase64)
        {
            byte[] signature;
            try { signature = Convert.FromBase64String(signatureBase64.Trim()); }
            catch (FormatException) { return false; }

            using var rsa = RSA.Create();
            rsa.FromXmlString(PublicKeyXml);
            return rsa.VerifyData(file, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        }
    }
}
