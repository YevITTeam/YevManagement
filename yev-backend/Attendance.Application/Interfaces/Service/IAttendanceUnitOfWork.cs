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
        IOtFormApprovalHistoryRepository OtFormApprovalHistories { get; }
        IUserSignatureRepository UserSignatures { get; }
        IPendingSignatureConfirmationRepository PendingSignatureConfirmations { get; }
        IOtFormApprovalEmailTokenRepository OtFormApprovalEmailTokens { get; }
        ISecondaryPasswordRepository SecondaryPasswords { get; }
        IPendingSecondaryPasswordConfirmationRepository PendingSecondaryPasswordConfirmations { get; }
        IAttendanceSettingRepository AttendanceSettings { get; }
        IWorkCalendarDayRepository WorkCalendarDays { get; }
        IOtFormBatchRepository OtFormBatches { get; }
        IOtFormBatchEmailTokenRepository OtFormBatchEmailTokens { get; }
        IJobTitleRepository JobTitles { get; }
        IDepartmentApprovalStepRepository DepartmentApprovalSteps { get; }
        IGroupApprovalStepRepository GroupApprovalSteps { get; }
        IDepartmentApprovalStepCoordinatorRepository DepartmentApprovalStepCoordinators { get; }
        IGroupApprovalStepCoordinatorRepository GroupApprovalStepCoordinators { get; }
        IOtFormApprovalStepRepository OtFormApprovalSteps { get; }
        IOtFormApprovalStepCandidateRepository OtFormApprovalStepCandidates { get; }
        IJobTitlePermissionRepository JobTitlePermissions { get; }
        IEmployeeAccumulationHistoryRepository EmployeeAccumulationHistories { get; }
        IProductionLineRepository ProductionLines { get; }
        IProductionShiftTeamRepository ProductionShiftTeams { get; }
        IProductionTeamRepository ProductionTeams { get; }
        IProductionEmployeeRepository ProductionEmployees { get; }
        IProductionApprovalStepRepository ProductionApprovalSteps { get; }
        IOtFormEditLogRepository OtFormEditLogs { get; }
    }
}
