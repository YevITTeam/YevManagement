using Attendance.Application.Dtos.ProductionEmployees;
using Attendance.Application.Interfaces.Service;
using Shared.Application.Services;

namespace Attendance.Application.Services
{
    // Phục vụ màn "Theo chuyền" khi tạo đơn OT (2026-08-24) — tìm người theo Line/Team/Nhóm
    // ca/CongDoan thay vì theo Group cố định (xem OtFormService.CreateProductionFormAsync). CHỈ trả
    // về người ĐÃ có EmployeeId (bảng ProductionEmployees vốn chỉ chứa dòng đã resolve đủ theo policy
    // nạp, xem ProductionEmployee.cs) — không cần lọc thêm ở đây.
    public class ProductionEmployeeService : BaseService<IAttendanceUnitOfWork>, IProductionEmployeeService
    {
        public ProductionEmployeeService(IAttendanceUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<List<ProductionEmployeeSearchItemDto>> SearchAsync(
            int? productionLineId, int? teamId, int? shiftTeamId, string? congDoan, string? keyword)
        {
            var trimmedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();

            var items = await _unitOfWork.ProductionEmployees.SelectAsync(
                predicate: x => !x.IsDeleted && x.EmployeeId != null
                    && (productionLineId == null || x.ProductionLineId == productionLineId)
                    && (teamId == null || x.TeamId == teamId)
                    && (shiftTeamId == null || x.ShiftTeamId == shiftTeamId)
                    && (congDoan == null || x.CongDoan == congDoan)
                    && (trimmedKeyword == null
                        || x.EmployeeCode.Contains(trimmedKeyword)
                        || x.Employee!.LastName.Contains(trimmedKeyword)
                        || x.Employee!.FirstName.Contains(trimmedKeyword)),
                selector: x => new ProductionEmployeeSearchItemDto
                {
                    EmployeeId = x.EmployeeId!.Value,
                    EmployeeCode = x.Employee!.Code,
                    FullName = x.Employee!.LastName + " " + x.Employee!.FirstName,
                    CongDoan = x.CongDoan,
                    TaskName = x.TaskName,
                    BlockCode = x.BlockCode,
                    TeamCode = x.TeamCode,
                    ShiftTeamCode = x.ShiftTeamCode,
                    ShiftTeamNameVn = x.ShiftTeam != null ? x.ShiftTeam.NameVn : null,
                    IsLeader = x.IsLeader
                });

            return items.OrderBy(x => x.EmployeeCode).ToList();
        }

        // teamId lọc Line theo đúng Team đã chọn — ProductionLine.TeamId là FK thật (xem ProductionLine.cs),
        // Team chứa Line CHỨ KHÔNG PHẢI ngược lại, nên chỉ Line mới cần tham số cascade này (2026-08-25).
        public async Task<List<ProductionOptionDto>> GetLineOptionsAsync(int? teamId)
        {
            var items = await _unitOfWork.ProductionLines.SelectAsync(
                predicate: x => !x.IsDeleted && (teamId == null || x.TeamId == teamId),
                selector: x => new ProductionOptionDto { Id = x.Id, Code = x.LineCode, NameVn = null });
            return items.OrderBy(x => x.Code).ToList();
        }

        public async Task<List<ProductionOptionDto>> GetTeamOptionsAsync()
        {
            var items = await _unitOfWork.ProductionTeams.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new ProductionOptionDto { Id = x.Id, Code = x.Code, NameVn = x.NameVn });
            return items.OrderBy(x => x.Code).ToList();
        }

        // Nhóm ca KHÔNG phải con của Line/Team (1 Line có thể xuất hiện ở nhiều Nhóm ca khác nhau, xem
        // ProductionShiftTeam.cs) nên không lọc được bằng FK như GetLineOptionsAsync — thay vào đó suy
        // ra TỪ DỮ LIỆU THẬT: chỉ trả về Nhóm ca nào thực sự có người trong đúng tập Line/Team đang lọc
        // (2026-08-25, theo yêu cầu người dùng — tránh cho chọn Nhóm ca rồi tìm ra danh sách rỗng).
        public async Task<List<ProductionOptionDto>> GetShiftTeamOptionsAsync(int? productionLineId, int? teamId)
        {
            var items = await _unitOfWork.ProductionEmployees.SelectAsync(
                predicate: x => !x.IsDeleted && x.EmployeeId != null && x.ShiftTeamId != null
                    && (productionLineId == null || x.ProductionLineId == productionLineId)
                    && (teamId == null || x.TeamId == teamId),
                selector: x => new ProductionOptionDto { Id = x.ShiftTeamId!.Value, Code = x.ShiftTeam!.Code, NameVn = x.ShiftTeam!.NameVn });

            return items.DistinctBy(x => x.Id).OrderBy(x => x.Code).ToList();
        }
    }
}
