namespace Shared.Application.Helper
{
    // Modules whose mail can be routed to a per-user address (Identity UserEmailModule).
    // IsApplied = the module already reads its recipient through IUserDirectoryService with its code.
    public static class EmailModules
    {
        public const string Attendance = "Attendance";
        public const string Workflow = "Workflow";

        public static readonly IReadOnlyList<EmailModuleInfo> All = new List<EmailModuleInfo>
        {
            new(Attendance, "Tăng ca (Attendance)", true),
            new(Workflow, "Quy trình (Workflow)", false),
        };

        public static bool IsKnown(string code) => All.Any(x => x.Code == code);
    }

    public record EmailModuleInfo(string Code, string Name, bool IsApplied);
}
