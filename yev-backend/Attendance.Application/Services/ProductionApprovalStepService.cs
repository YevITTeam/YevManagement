using Attendance.Application.Dtos.ProductionApprovalSteps;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Quản lý cây duyệt cấu hình tay cho đơn OT "theo chuyền" (Chế tạo, 2026-08-24) — 1 danh sách
    // DUY NHẤT theo từng Bộ phận, gộp cả cấp trung gian (Line Leader/Group Leader/Team Leader) lẫn
    // cấp cuối (Manager/Factory Manager/Director) trong CÙNG 1 chuỗi — khác DepartmentApprovalStep +
    // GroupApprovalStep của đơn "theo Nhóm" (2 tầng riêng). Lý do gộp: Chế tạo có 137 Group, cấu hình
    // riêng từng Group theo kiểu GroupApprovalStep là không khả thi — xem ProductionApprovalStep.
    // Không có Create/Update/Delete từng dòng riêng lẻ, chỉ thay NGUYÊN danh sách 1 lần.
    public class ProductionApprovalStepService : BaseService<IAttendanceUnitOfWork>, IProductionApprovalStepService
    {
        public ProductionApprovalStepService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        // Tái dùng DepartmentApprovalStepCoordinator (không tạo bảng phụ trách riêng) — người được
        // Admin phân công phụ trách Cây duyệt của 1 Bộ phận thì phụ trách CẢ 2 loại cây duyệt
        // (theo Nhóm lẫn theo chuyền) của Bộ phận đó.
        private async Task EnsureCanManageDepartmentAsync(string userName, bool isAdmin, int departmentId)
        {
            if (isAdmin) return;

            var isCoordinator = (await _unitOfWork.DepartmentApprovalStepCoordinators.FindAsync(
                x => x.DepartmentId == departmentId && x.Employee.UserName == userName && !x.IsDeleted)).Count > 0;
            if (!isCoordinator)
                throw new DomainException("Bạn không được phân công phụ trách Cây duyệt của Bộ phận này.");
        }

        public async Task<List<ProductionApprovalStepDto>> GetByDepartmentAsync(string userName, bool isAdmin, int departmentId)
        {
            await EnsureCanManageDepartmentAsync(userName, isAdmin, departmentId);
            return await GetByDepartmentCoreAsync(departmentId);
        }

        private async Task<List<ProductionApprovalStepDto>> GetByDepartmentCoreAsync(int departmentId)
        {
            var department = await _unitOfWork.Departments.GetByIdAsync(departmentId);
            department.OrThrowNotFound("Phòng ban", departmentId);

            var steps = await _unitOfWork.ProductionApprovalSteps.SelectAsync(
                predicate: x => x.DepartmentId == departmentId && !x.IsDeleted,
                selector: x => new ProductionApprovalStepDto
                {
                    Id = x.Id,
                    DepartmentId = x.DepartmentId,
                    StepOrder = x.StepOrder,
                    JobTitleId = x.JobTitleId,
                    JobTitleCode = x.JobTitle.Code,
                    JobTitleName = x.JobTitle.Name,
                    RankOrder = x.JobTitle.RankOrder,
                    RequiresSignature = x.RequiresSignature,
                    IsResponsible = x.IsResponsible,
                    TerminalLevel = x.JobTitle.TerminalLevel,
                    IsLineScoped = x.JobTitle.IsLineScoped
                });

            return steps.OrderBy(x => x.StepOrder).ToList();
        }

        public async Task<List<ProductionApprovalStepDto>> ReplaceAsync(string userName, bool isAdmin, int departmentId, ReplaceProductionApprovalStepsDto request)
        {
            await EnsureCanManageDepartmentAsync(userName, isAdmin, departmentId);

            var department = await _unitOfWork.Departments.GetByIdAsync(departmentId);
            department.OrThrowNotFound("Phòng ban", departmentId);

            if (request.Steps.Select(x => x.JobTitleId).Distinct().Count() != request.Steps.Count)
                throw new DomainException("Danh sách bước duyệt không được lặp lại cùng 1 Chức vụ.");

            if (request.Steps.Count(x => x.IsResponsible) > 1)
                throw new DomainException("Chỉ được đánh dấu tối đa 1 bước là \"người chịu trách nhiệm\".");

            // Không giới hạn TerminalLevel như DepartmentApprovalStep — danh sách này nhận CẢ cấp
            // trung gian (Line Leader/Group Leader/Team Leader) lẫn cấp cuối (Manager/Factory
            // Manager/Director) trong cùng 1 chuỗi.
            var jobTitleIds = request.Steps.Select(x => x.JobTitleId).ToHashSet();
            var jobTitlesById = (await _unitOfWork.JobTitles.FindAsync(x => jobTitleIds.Contains(x.Id) && !x.IsDeleted))
                .ToDictionary(x => x.Id);

            var intermediateSigningCount = 0;
            var intermediateStepCount = 0;
            foreach (var item in request.Steps)
            {
                var jobTitle = jobTitlesById.GetValueOrDefault(item.JobTitleId);
                jobTitle.OrThrowNotFound("Chức vụ", item.JobTitleId);
                if (jobTitle!.TerminalLevel == (int)JobTitleTerminalLevel.None)
                {
                    intermediateStepCount++;
                    if (item.RequiresSignature) intermediateSigningCount++;
                }
            }

            // Đúng 2 ô "Người đề nghị" cố định trên giấy in YEV-22-024 — CHỈ tính cấp trung gian (Line
            // Leader/Group Leader/Team Leader, TerminalLevel=None), vì 3 cấp cuối (Manager/Factory
            // Manager/Director) đã có 3 ô chữ ký RIÊNG trên giấy, không dùng chung 2 ô này — mirror
            // GroupApprovalStepService.ReplaceAsync (2026-08-25).
            if (intermediateStepCount > 0 && (intermediateSigningCount < 1 || intermediateSigningCount > 2))
                throw new DomainException("Phải có từ 1 đến 2 bước CẤP TRUNG GIAN (Line Leader/Group Leader/Team Leader) được đánh dấu \"Bắt buộc ký\" (khớp 2 ô \"Người đề nghị\" cố định trên giấy in) — các bước khác (kể cả cấp cuối) để \"Chỉ xác nhận\"/dùng ô chữ ký riêng, không giới hạn số lượng.");

            var existing = await _unitOfWork.ProductionApprovalSteps.FindAsync(x => x.DepartmentId == departmentId && !x.IsDeleted);
            foreach (var step in existing)
            {
                _unitOfWork.ProductionApprovalSteps.Delete(step);
            }

            var newSteps = request.Steps
                .Select((item, index) => new ProductionApprovalStep
                {
                    DepartmentId = departmentId,
                    StepOrder = index + 1,
                    JobTitleId = item.JobTitleId,
                    RequiresSignature = item.RequiresSignature,
                    IsResponsible = item.IsResponsible,
                    IsDeleted = false
                })
                .ToList();

            await _unitOfWork.ProductionApprovalSteps.AddRangeAsync(newSteps);
            await _unitOfWork.SaveChangesAsync();

            return await GetByDepartmentCoreAsync(departmentId);
        }
    }
}
