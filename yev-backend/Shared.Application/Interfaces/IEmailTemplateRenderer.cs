namespace Shared.Application.Interfaces
{
    // Reads static .html files (each module keeps its own templates under an EmailTemplates/ folder,
    // copied to the build output via <Content CopyToOutputDirectory>) then replaces {{Key}} placeholders
    // with real values — keeps email content out of C# code, no more manual HTML string concatenation in the Service.
    public interface IEmailTemplateRenderer
    {
        // relativeTemplatePath looks like "OtForm/ApprovalNotification.html" (relative to the EmailTemplates
        // folder in the build output) — each module places its files under a subfolder named after its feature.
        string Render(string relativeTemplatePath, IDictionary<string, string> placeholders);
    }
}
