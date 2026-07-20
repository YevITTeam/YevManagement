using System.Text;
using Shared.Application.Interfaces;

namespace Shared.Infrastructure.Services
{
    // Reads static .html files from the "EmailTemplates" folder next to the DLL after build (each module
    // copies its own files here via <Content CopyToOutputDirectory>, see Attendance.Infrastructure/EmailTemplates/)
    // — keeps email content/formatting out of C# code, so text changes don't require touching the Service.
    // Replaces "{{Key}}" placeholders with real values; no external template engine is used since the current
    // need is just simple string substitution.
    public class EmailTemplateService : IEmailTemplateRenderer
    {
        private static readonly string TemplatesRoot = Path.Combine(AppContext.BaseDirectory, "EmailTemplates");

        public string Render(string relativeTemplatePath, IDictionary<string, string> placeholders)
        {
            var fullPath = Path.Combine(TemplatesRoot, relativeTemplatePath);
            if (!File.Exists(fullPath))
                throw new FileNotFoundException($"Không tìm thấy file template email: {fullPath}");

            var content = File.ReadAllText(fullPath, Encoding.UTF8);

            foreach (var (key, value) in placeholders)
                content = content.Replace($"{{{{{key}}}}}", value);

            return content;
        }
    }
}
