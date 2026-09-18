namespace Asset.Application.Interfaces.Service
{
    // Reads the raw bytes of the official checksheet Excel template (YEV–22–CV–IT-QD-810-FR-Check
    // Sheet KT) so ServerCheckService can fill it in for export/print — kept in Infrastructure
    // (implementation reads a file from disk) while Application only depends on this interface,
    // same split as IEmailTemplateRenderer/EmailTemplateService in Shared.
    public interface IServerCheckTemplateService
    {
        byte[] GetCheckSheetTemplateBytes();
    }
}
