namespace Asset.Application.Interfaces.Service
{
    // Trừu tượng hoá lưu file .apk trên đĩa (asset-module.md §1.23) — mirror
    // Workflow.Application.Interfaces.Service.IWorkflowAttachmentStorage: interface ở Application,
    // implementation đọc appsettings ở Infrastructure (Application không biết đường dẫn vật lý).
    public interface IAppReleaseFileStorage
    {
        Task<string> SaveAsync(Stream content, string originalFileName);

        string GetPhysicalPath(string storedFileName);
    }
}
