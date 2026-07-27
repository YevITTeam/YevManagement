using Attendance.Application.Interfaces.Repository;
using Attendance.Application.Interfaces.Service;
using Attendance.Infrastructure.Context;
using Shared.Infrastructure.Data;

namespace Attendance.Infrastructure.Repositories
{
    public class AttendanceUnitOfWork : BaseUnitOfWork<AttendanceDbContext>, IAttendanceUnitOfWork
    {
        public AttendanceUnitOfWork(
            AttendanceDbContext dbContext,
            IDepartmentRepository departments,
            IGroupRepository groups,
            IReasonRepository reasons,
            IOtCaseRepository otCases,
            IEmployeeRepository employees,
            IOtFormRepository otForms,
            IOtFormEmployeeRepository otFormEmployees,
            IProcessPartRepository processParts,
            IUserApprovalScopeRepository userApprovalScopes,
            IOtFormApprovalHistoryRepository otFormApprovalHistories,
            IUserSignatureRepository userSignatures,
            IPendingSignatureConfirmationRepository pendingSignatureConfirmations,
            IOtFormApprovalEmailTokenRepository otFormApprovalEmailTokens) : base(dbContext)
        {
            Departments = departments;
            Groups = groups;
            Reasons = reasons;
            OtCases = otCases;
            Employees = employees;
            OtForms = otForms;
            OtFormEmployees = otFormEmployees;
            ProcessParts = processParts;
            UserApprovalScopes = userApprovalScopes;
            OtFormApprovalHistories = otFormApprovalHistories;
            UserSignatures = userSignatures;
            PendingSignatureConfirmations = pendingSignatureConfirmations;
            OtFormApprovalEmailTokens = otFormApprovalEmailTokens;
        }

        public IDepartmentRepository Departments { get; }
        public IGroupRepository Groups { get; }
        public IReasonRepository Reasons { get; }
        public IOtCaseRepository OtCases { get; }
        public IEmployeeRepository Employees { get; }
        public IOtFormRepository OtForms { get; }
        public IOtFormEmployeeRepository OtFormEmployees { get; }
        public IProcessPartRepository ProcessParts { get; }
        public IUserApprovalScopeRepository UserApprovalScopes { get; }
        public IOtFormApprovalHistoryRepository OtFormApprovalHistories { get; }
        public IUserSignatureRepository UserSignatures { get; }
        public IPendingSignatureConfirmationRepository PendingSignatureConfirmations { get; }
        public IOtFormApprovalEmailTokenRepository OtFormApprovalEmailTokens { get; }
    }
}
