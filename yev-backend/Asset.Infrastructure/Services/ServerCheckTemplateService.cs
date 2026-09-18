using Asset.Application.Interfaces.Service;

namespace Asset.Infrastructure.Services
{
    // Reads the "Templates\CheckSheetKiemTraHangNgayIT.xlsx" file copied next to the DLL by
    // Asset.Infrastructure.csproj (<Content CopyToOutputDirectory>) — same approach as
    // Shared.Infrastructure/Services/EmailTemplateService.cs.
    public class ServerCheckTemplateService : IServerCheckTemplateService
    {
        private static readonly string TemplatePath = Path.Combine(AppContext.BaseDirectory, "Templates", "CheckSheetKiemTraHangNgayIT.xlsx");

        public byte[] GetCheckSheetTemplateBytes()
        {
            if (!File.Exists(TemplatePath))
                throw new FileNotFoundException($"Không tìm thấy file mẫu Check Sheet: {TemplatePath}");

            return File.ReadAllBytes(TemplatePath);
        }
    }
}
