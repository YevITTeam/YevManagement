using System.Text.RegularExpressions;

namespace Asset.Application.Services
{
    // Derives a device code from a Computer Name; shared by the Tanium import and the USB agent ingest.
    public static class ComputerNameParser
    {
        // Only these families are managed. "ACLF"/"ALF" are other families (a letter right after "AC").
        private static readonly string[] StandardFamilyPrefixes = { "YDC", "YLC", "YDF", "TYC" };
        private static readonly Regex AcFamilyPattern = new(@"^AC\d+[A-Za-z]?$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        // Null when the name is outside the managed families. The domain suffix after the first "." is dropped.
        // YDC/YLC/YDF/TYC + digits: the code puts "-" between letters and digits (YDC1877 -> YDC-1877).
        // AC + digits + optional letter: the code is the first two "-" segments (AC90B-2446).
        public static string? Parse(string rawComputerName)
        {
            var name = rawComputerName.Trim();
            var dotIndex = name.IndexOf('.');
            if (dotIndex >= 0) name = name[..dotIndex];

            var segments = name.Split('-', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0) return null;

            var firstSegment = segments[0];

            var standardPrefix = StandardFamilyPrefixes.FirstOrDefault(p =>
                firstSegment.StartsWith(p, StringComparison.OrdinalIgnoreCase) &&
                firstSegment[p.Length..].All(char.IsDigit));
            if (standardPrefix != null)
            {
                var digits = firstSegment[standardPrefix.Length..];
                return digits.Length > 0 ? $"{standardPrefix}-{digits}" : standardPrefix;
            }

            if (AcFamilyPattern.IsMatch(firstSegment))
            {
                return segments.Length > 1 ? $"{segments[0]}-{segments[1]}" : segments[0];
            }

            return null;
        }
    }
}
