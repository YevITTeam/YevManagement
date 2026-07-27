using System.Text;

namespace Shared.Application.Helper
{
    // Reads a raw CSV file into rows/columns of strings, shared by the import features
    // (Asset.DeviceImport/DeviceConfigurationImport) — CSV is usually the default export
    // format of inventory tools (e.g. Tanium), instead of forcing users to manually
    // convert to .xlsx before importing.
    public static class CsvFileHelper
    {
        public static bool HasCsvExtension(string? fileName) =>
            !string.IsNullOrWhiteSpace(fileName) && fileName.Trim().EndsWith(".csv", StringComparison.OrdinalIgnoreCase);

        // Returns each row as an array of trimmed cells (the first row is the header; the caller is
        // responsible for Skip(1), same as ClosedXML). Auto-detects the delimiter (',' or ';')
        // based on the header row — Vietnamese-locale Excel usually exports CSV with ';' (since ','
        // is the decimal separator), while US/Tanium tools usually use ','. Supports fields
        // wrapped in double quotes (containing delimiters/newlines inside, escaped "" → ").
        public static List<string[]> ReadRows(Stream stream)
        {
            using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            var content = reader.ReadToEnd();
            if (string.IsNullOrEmpty(content)) return new List<string[]>();

            return Tokenize(content, DetectDelimiter(content));
        }

        private static char DetectDelimiter(string content)
        {
            var firstLineEnd = content.IndexOfAny(new[] { '\r', '\n' });
            var headerLine = firstLineEnd >= 0 ? content[..firstLineEnd] : content;
            var commaCount = headerLine.Count(c => c == ',');
            var semicolonCount = headerLine.Count(c => c == ';');
            return semicolonCount > commaCount ? ';' : ',';
        }

        private static List<string[]> Tokenize(string content, char delimiter)
        {
            var rows = new List<string[]>();
            var fields = new List<string>();
            var field = new StringBuilder();
            var inQuotes = false;
            var length = content.Length;
            var i = 0;

            void EndField()
            {
                fields.Add(field.ToString().Trim());
                field.Clear();
            }

            void EndRow()
            {
                EndField();
                // Skip completely empty rows (e.g. a blank line at the end of the file).
                if (!(fields.Count == 1 && fields[0].Length == 0))
                    rows.Add(fields.ToArray());
                fields = new List<string>();
            }

            while (i < length)
            {
                var c = content[i];

                if (inQuotes)
                {
                    if (c == '"')
                    {
                        if (i + 1 < length && content[i + 1] == '"')
                        {
                            field.Append('"');
                            i += 2;
                            continue;
                        }
                        inQuotes = false;
                        i++;
                        continue;
                    }
                    field.Append(c);
                    i++;
                    continue;
                }

                switch (c)
                {
                    case '"':
                        inQuotes = true;
                        i++;
                        continue;
                    case '\r':
                        if (i + 1 < length && content[i + 1] == '\n') i++;
                        EndRow();
                        i++;
                        continue;
                    case '\n':
                        EndRow();
                        i++;
                        continue;
                    default:
                        if (c == delimiter)
                        {
                            EndField();
                            i++;
                            continue;
                        }
                        field.Append(c);
                        i++;
                        continue;
                }
            }

            if (field.Length > 0 || fields.Count > 0)
                EndRow();

            return rows;
        }
    }
}
