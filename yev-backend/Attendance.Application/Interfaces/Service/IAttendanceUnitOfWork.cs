using Attendance.Application.Interfaces.Repository;
using Shared.Application.Abstractions;

namespace Attendance.Application.Interfaces.Service
{
    public interface IAttendanceUnitOfWork : IUnitOfWork
    {
        IDepartmentRepository Departments { get; }
        IGroupRepository Groups { get; }
        IReasonRepository Reasons { get; }
        IOtCaseRepository OtCases { get; }
        IEmployeeRepository Employees { get; }
        IOtFormRepository OtForms { get; }
        IOtFormEmployeeRepository OtFormEmployees { get; }
        IProcessPartRepository ProcessParts { get; }
        IUserApprovalScopeRepository UserApprovalScopes { get; }
        IOtFormApprovalHistoryRepository OtFormApprovalHistories { get; }
        IUserSignatureRepository UserSignatures { get; }
        IPendingSignatureConfirmationRepository PendingSignatureConfirmations { get; }
        IOtFormApprovalEmailTokenRepository OtFormApprovalEmailTokens { get; }
        ISecondaryPasswordRepository SecondaryPasswords { get; }
        IPendingSecondaryPasswordConfirmationRepository PendingSecondaryPasswordConfirmations { get; }
        IAttendanceSettingRepository AttendanceSettings { get; }
        IOtFormBatchRepository OtFormBatches { get; }
        IOtFormBatchEmailTokenRepository OtFormBatchEmailTokens { get; }
    }
}
