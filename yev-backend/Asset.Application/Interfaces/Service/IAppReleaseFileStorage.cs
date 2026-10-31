namespace Asset.Application.Interfaces.Service
{
    // Keeps physical paths out of Application; the Infrastructure implementation reads appsettings.
    public interface IAppReleaseFileStorage
    {
        Task<string> SaveAsync(Stream content, string originalFileName);

        string GetPhysicalPath(string storedFileName);
    }
}
