using Attendance.Application.Dtos.ProductionEmployeeImports;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Entities;
using ClosedXML.Excel;
using Shared.Application.Helper;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // Nạp hàng loạt "Nhân sự dưới chuyền" (ProductionEmployee) từ file mẫu Import_Nhan_Su_Che_Tao.xlsx
    // (sheet "OT(N+1)") — xem docs/docs-be/attendance-module.md §Import nhân sự dưới chuyền. Upsert theo
    // EmployeeCode; người không còn xuất hiện trong file mới bị gỡ (soft-delete) khỏi ProductionEmployees.
    // Mã nhân viên chưa có Employee tương ứng được PHÉP tự tạo (2026-08-27, khác EmployeeImportService —
    // gán vào Group "Chưa phân loại" dưới Phòng ban Chế Tạo vì file này không cho đủ dữ liệu Nhóm thật).
    public class ProductionEmployeeImportService : BaseService<IAttendanceUnitOfWork>, IProductionEmployeeImportService
    {
        // Bộ phận Chế Tạo (đã có sẵn trong hệ thống) — nơi chứa Group "Chưa phân loại" dùng cho nhân
        // viên tự tạo từ import này (2026-08-27, theo yêu cầu người dùng).
        private const string ManufacturingDepartmentCode = "CT";
        private const string UnclassifiedGroupCode = "KHAC";
        private const string UnclassifiedGroupNameVn = "Chưa phân loại (nhập từ file chuyền)";

        // GROUP trong file dịch sang Code của ProductionTeam: A->1, B->2, HC->HC, còn lại khớp trực
        // tiếp (không phân biệt hoa/thường) — xem ProductionEmployee.cs.
        private static readonly Dictionary<string, string> TeamCodeTranslation =
            new(StringComparer.OrdinalIgnoreCase) { ["A"] = "1", ["B"] = "2", ["HC"] = "HC" };

        private readonly IDepartmentAccessGuard _departmentAccessGuard;

        public ProductionEmployeeImportService(IAttendanceUnitOfWork unitOfWork, IDepartmentAccessGuard departmentAccessGuard)
            : base(unitOfWork)
        {
            _departmentAccessGuard = departmentAccessGuard;
        }

        // Đích của import này đã hardcode cứng vào ĐÚNG 1 Phòng ban (ManufacturingDepartmentCode) —
        // khác ApplyAccumulationAsync (nhận EmployeeCode tự do, phải scope theo TỪNG dòng) — nên chỉ
        // cần check 1 lần cho cả file (2026-08-29, xem docs/docs-be/attendance-module.md §Phân quyền
        // theo Phòng ban).
        private async Task EnsureManufacturingDepartmentAccessAsync(string userName, bool isAdmin)
        {
            var department = (await _unitOfWork.Departments.FirstOrDefaultAsync(
                x => !x.IsDeleted && x.DepartmentCode == ManufacturingDepartmentCode))
                .OrThrowNotFound($"Phòng ban mã '{ManufacturingDepartmentCode}'", ManufacturingDepartmentCode);
            await _departmentAccessGuard.EnsureCanManageDepartmentAsync(userName, isAdmin, department.Id);
        }

        public async Task<ProductionEmployeeImportPreviewResultDto> PreviewAsync(Stream excelFileStream, string userName, bool isAdmin)
        {
            await EnsureManufacturingDepartmentAccessAsync(userName, isAdmin);

            var rawRows = ParseXlsx(excelFileStream);
            var (validatedRows, removedRows) = await ValidateAndResolveRowsAsync(rawRows);

            return new ProductionEmployeeImportPreviewResultDto
            {
                Rows = validatedRows,
                TotalRows = validatedRows.Count,
                ValidRows = validatedRows.Count(r => r.IsValid),
                InvalidRows = validatedRows.Count(r => !r.IsValid),
                NewEmployeeCount = validatedRows.Count(r => r.IsValid && r.IsNewEmployee),
                NewProductionEmployeeCount = validatedRows.Count(r => r.IsValid && r.IsNewProductionEmployee),
                UpdatedProductionEmployeeCount = validatedRows.Count(r => r.IsValid && !r.IsNewProductionEmployee && r.IsUpdatedProductionEmployee),
                UnchangedProductionEmployeeCount = validatedRows.Count(r => r.IsValid && !r.IsNewProductionEmployee && !r.IsUpdatedProductionEmployee),
                RemovedProductionEmployeeCount = removedRows.Count,
                RemovedRows = removedRows
            };
        }

        public async Task<ProductionEmployeeImportConfirmResultDto> ConfirmAsync(ConfirmProductionEmployeeImportDto request, string userName, bool isAdmin)
        {
            await EnsureManufacturingDepartmentAccessAsync(userName, isAdmin);

            // Re-validate từ đầu theo dữ liệu DB hiện tại — không tin Resolved*/Is* mà client gửi lại,
            // đề phòng dữ liệu đã đổi kể từ lúc xem Preview (cùng nguyên tắc EmployeeImportService).
            var (validatedRows, removedRows) = await ValidateAndResolveRowsAsync(request.Rows);

            var invalidRows = validatedRows.Where(x => !x.IsValid).ToList();
            var validRows = validatedRows.Where(x => x.IsValid).ToList();

            var result = new ProductionEmployeeImportConfirmResultDto
            {
                SkippedCount = invalidRows.Count,
                SkippedRows = invalidRows
                    .Select(r => new ProductionEmployeeImportSkippedRowDto { RowNumber = r.RowNumber, EmployeeCode = r.EmployeeCode, Errors = r.Errors })
                    .ToList(),
                RemovedProductionEmployeeCount = removedRows.Count
            };

            if (validRows.Count == 0 && removedRows.Count == 0) return result;

            await _unitOfWork.BeginTransactionAsync();
            try
            {
                var newEmployeeRows = validRows.Where(r => r.IsNewEmployee).ToList();
                Group? unclassifiedGroup = null;

                if (newEmployeeRows.Count > 0)
                {
                    var department = (await _unitOfWork.Departments.FirstOrDefaultAsync(
                        x => !x.IsDeleted && x.DepartmentCode == ManufacturingDepartmentCode))
                        .OrThrowNotFound($"Phòng ban mã '{ManufacturingDepartmentCode}'", ManufacturingDepartmentCode);

                    unclassifiedGroup = await _unitOfWork.Groups.FirstOrDefaultAsync(
                        x => !x.IsDeleted && x.GroupCode == UnclassifiedGroupCode && x.DepartmentId == department.Id);
                    if (unclassifiedGroup == null)
                    {
                        unclassifiedGroup = new Group
                        {
                            GroupCode = UnclassifiedGroupCode,
                            GroupNameVn = UnclassifiedGroupNameVn,
                            DepartmentId = department.Id,
                            IsDeleted = false
                        };
                        await _unitOfWork.Groups.AddAsync(unclassifiedGroup);
                        result.CreatedGroupCount = 1;
                    }
                }

                // Employee mới tạo được gán qua navigation property (chưa có Id thật) — EF tự fix up FK
                // lúc SaveChangesAsync, giống cách EmployeeImportService gán Group/Department mới tạo.
                var newEmployeesByCode = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);
                foreach (var row in newEmployeeRows)
                {
                    var newEmployee = new Employee
                    {
                        Code = row.EmployeeCode!.Trim(),
                        LastName = row.LastName!.Trim(),
                        FirstName = row.FirstName!.Trim(),
                        Group = unclassifiedGroup,
                        IsDeleted = false
                    };
                    await _unitOfWork.Employees.AddAsync(newEmployee);
                    newEmployeesByCode[newEmployee.Code] = newEmployee;
                    result.CreatedEmployeeCount++;
                }

                var existingEmployeeCodesToLookUp = validRows
                    .Where(r => !r.IsNewEmployee)
                    .Select(r => r.EmployeeCode!.Trim())
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                var existingEmployeesByCode = existingEmployeeCodesToLookUp.Count == 0
                    ? new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase)
                    : (await _unitOfWork.Employees.FindAsync(x => !x.IsDeleted && existingEmployeeCodesToLookUp.Contains(x.Code)))
                        .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

                var existingProductionEmployeesByCode = (await _unitOfWork.ProductionEmployees.FindAsync(x => !x.IsDeleted))
                    .ToDictionary(x => x.EmployeeCode.Trim(), StringComparer.OrdinalIgnoreCase);

                foreach (var row in validRows)
                {
                    var code = row.EmployeeCode!.Trim();
                    int? employeeId = row.IsNewEmployee ? null : existingEmployeesByCode[code].Id;
                    var newEmployeeEntity = row.IsNewEmployee ? newEmployeesByCode[code] : null;

                    if (existingProductionEmployeesByCode.TryGetValue(code, out var existingPe))
                    {
                        existingPe.CongDoan = row.CongDoan;
                        existingPe.TaskName = row.TaskName;
                        existingPe.BlockCode = row.BlockCode;
                        existingPe.ProductionLineId = row.ResolvedProductionLineId;
                        existingPe.TeamCode = row.TeamCode;
                        existingPe.TeamId = row.ResolvedTeamId;
                        existingPe.ShiftTeamCode = row.ShiftTeamCode;
                        existingPe.ShiftTeamId = row.ResolvedShiftTeamId;
                        existingPe.IsLeader = row.IsLeader;
                        if (newEmployeeEntity != null) existingPe.Employee = newEmployeeEntity;
                        else existingPe.EmployeeId = employeeId;

                        _unitOfWork.ProductionEmployees.Update(existingPe);
                        if (row.IsUpdatedProductionEmployee) result.UpdatedProductionEmployeeCount++;
                    }
                    else
                    {
                        var newPe = new ProductionEmployee
                        {
                            EmployeeCode = code,
                            CongDoan = row.CongDoan,
                            TaskName = row.TaskName,
                            BlockCode = row.BlockCode,
                            ProductionLineId = row.ResolvedProductionLineId,
                            TeamCode = row.TeamCode,
                            TeamId = row.ResolvedTeamId,
                            ShiftTeamCode = row.ShiftTeamCode,
                            ShiftTeamId = row.ResolvedShiftTeamId,
                            IsLeader = row.IsLeader,
                            IsDeleted = false
                        };
                        if (newEmployeeEntity != null) newPe.Employee = newEmployeeEntity;
                        else newPe.EmployeeId = employeeId;

                        await _unitOfWork.ProductionEmployees.AddAsync(newPe);
                        result.CreatedProductionEmployeeCount++;
                    }
                }

                if (removedRows.Count > 0)
                {
                    var removedCodes = removedRows.Select(r => r.EmployeeCode).ToHashSet(StringComparer.OrdinalIgnoreCase);
                    var toRemove = (await _unitOfWork.ProductionEmployees.FindAsync(
                        x => !x.IsDeleted && removedCodes.Contains(x.EmployeeCode)));
                    foreach (var pe in toRemove)
                    {
                        pe.IsDeleted = true;
                        _unitOfWork.ProductionEmployees.Update(pe);
                    }
                }

                await _unitOfWork.SaveChangesAsync();
                await _unitOfWork.CommitTransactionAsync();
            }
            catch
            {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }

            return result;
        }

        // Tách riêng khỏi ConfirmAsync (2026-08-27, theo yêu cầu người dùng) — đụng lũy kế OT là dữ
        // liệu ảnh hưởng lương, cần quyền riêng (Attendance.EmployeeAccumulation.Import) và Admin phải
        // tự chọn tay Year/Month áp dụng. (EmployeeId, Year, Month) có unique index trên
        // EmployeeAccumulationHistories nên không tách được 1 dòng riêng cho phần điều chỉnh — chỉ có
        // thể cộng thêm CHÊNH LỆCH vào đúng dòng của tháng đó rồi ghi chú lại nguồn gốc (Note).
        public async Task<ProductionEmployeeAccumulationResultDto> ApplyAccumulationAsync(ApplyProductionEmployeeAccumulationDto request, string userName, bool isAdmin)
        {
            var result = new ProductionEmployeeAccumulationResultDto();

            var candidateRows = request.Rows
                .Where(r => !string.IsNullOrWhiteSpace(r.EmployeeCode) && r.OtMonthHours.HasValue)
                .ToList();
            if (candidateRows.Count == 0) return result;

            // Khác ConfirmAsync (1 Phòng ban cố định) — file này nhận EmployeeCode TỰ DO, phải scope
            // THEO TỪNG DÒNG: lấy trước danh sách Phòng ban người gọi phụ trách (Admin bỏ qua hoàn
            // toàn), rồi so với Phòng ban thật của từng nhân viên trong vòng lặp bên dưới (2026-08-29,
            // xem docs/docs-be/attendance-module.md §Phân quyền theo Phòng ban).
            var managedDepartmentIds = isAdmin
                ? null
                : await _departmentAccessGuard.GetManagedDepartmentIdsAsync(userName);

            var codes = candidateRows.Select(r => r.EmployeeCode!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var employeesByCode = (await _unitOfWork.Employees.SelectAsync(
                x => !x.IsDeleted && codes.Contains(x.Code),
                x => new { x.Id, x.Code, DepartmentId = x.DepartmentId ?? (x.Group != null ? (int?)x.Group.DepartmentId : null) }))
                .ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

            var employeeIds = employeesByCode.Values.Select(x => x.Id).ToList();
            var existingLedgerRows = employeeIds.Count == 0
                ? new Dictionary<int, EmployeeAccumulationHistory>()
                : (await _unitOfWork.EmployeeAccumulationHistories.FindAsync(
                    x => employeeIds.Contains(x.EmployeeId) && x.Year == request.Year && x.Month == request.Month))
                    .ToDictionary(x => x.EmployeeId);

            var note = $"Điều chỉnh từ import nhân sự dưới chuyền ngày {TimeHelper.GetCurrentUtcTime():dd/MM/yyyy HH:mm}";

            foreach (var row in candidateRows)
            {
                var code = row.EmployeeCode!.Trim();
                if (!employeesByCode.TryGetValue(code, out var employee))
                {
                    result.SkippedCount++;
                    result.SkippedRows.Add(new ProductionEmployeeAccumulationSkippedRowDto
                    {
                        EmployeeCode = code,
                        Reason = "Không tìm thấy nhân viên trong hệ thống."
                    });
                    continue;
                }

                if (managedDepartmentIds != null && (employee.DepartmentId == null || !managedDepartmentIds.Contains(employee.DepartmentId.Value)))
                {
                    result.SkippedCount++;
                    result.SkippedRows.Add(new ProductionEmployeeAccumulationSkippedRowDto
                    {
                        EmployeeCode = code,
                        Reason = "Nhân viên không thuộc Phòng ban bạn phụ trách."
                    });
                    continue;
                }

                var targetHours = row.OtMonthHours!.Value;
                var hasLedgerRow = existingLedgerRows.TryGetValue(employee.Id, out var ledgerRow);
                var currentHours = hasLedgerRow ? ledgerRow!.TotalHours : 0m;
                var delta = targetHours - currentHours;

                if (delta == 0)
                {
                    result.UnchangedCount++;
                    continue;
                }

                if (hasLedgerRow)
                {
                    ledgerRow!.TotalHours += delta;
                    ledgerRow.Note = string.IsNullOrEmpty(ledgerRow.Note) ? note : ledgerRow.Note + "; " + note;
                    _unitOfWork.EmployeeAccumulationHistories.Update(ledgerRow);
                }
                else
                {
                    await _unitOfWork.EmployeeAccumulationHistories.AddAsync(new EmployeeAccumulationHistory
                    {
                        EmployeeId = employee.Id,
                        Year = request.Year,
                        Month = request.Month,
                        TotalHours = delta,
                        Note = note
                    });
                }

                result.AdjustedCount++;
                result.TotalDeltaHours += delta;
            }

            await _unitOfWork.SaveChangesAsync();
            return result;
        }

        private async Task<(List<ProductionEmployeeImportRowDto> Rows, List<ProductionEmployeeRemovedRowDto> RemovedRows)>
            ValidateAndResolveRowsAsync(List<ProductionEmployeeImportRowDto> rawRows)
        {
            var existingEmployeeCodes = (await _unitOfWork.Employees.SelectAsync(x => !x.IsDeleted, x => x.Code))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var lines = await _unitOfWork.ProductionLines.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.LineCode });
            var linesByCode = lines.ToDictionary(x => x.LineCode.Trim(), x => x.Id, StringComparer.OrdinalIgnoreCase);

            var teams = await _unitOfWork.ProductionTeams.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.Code });
            var teamsByCode = teams.ToDictionary(x => x.Code.Trim(), x => x.Id, StringComparer.OrdinalIgnoreCase);

            var shiftTeams = await _unitOfWork.ProductionShiftTeams.SelectAsync(x => !x.IsDeleted, x => new { x.Id, x.Code });
            var shiftTeamsByCode = shiftTeams.ToDictionary(x => x.Code.Trim(), x => x.Id, StringComparer.OrdinalIgnoreCase);

            var existingProductionEmployees = await _unitOfWork.ProductionEmployees.FindWithIncludesAsync(x => !x.IsDeleted, x => x.Employee!);
            var existingProductionEmployeesByCode = existingProductionEmployees
                .ToDictionary(x => x.EmployeeCode.Trim(), StringComparer.OrdinalIgnoreCase);

            var duplicatedCodesInFile = FindDuplicates(rawRows, r => r.EmployeeCode);

            var result = new List<ProductionEmployeeImportRowDto>();
            foreach (var row in rawRows)
            {
                var errors = new List<string>();
                var code = row.EmployeeCode?.Trim();
                var lastName = row.LastName?.Trim();
                var firstName = row.FirstName?.Trim();

                var isNewEmployee = false;
                if (string.IsNullOrWhiteSpace(code))
                {
                    errors.Add("Thiếu mã nhân viên (MNV).");
                }
                else
                {
                    if (duplicatedCodesInFile.Contains(code))
                        errors.Add($"Mã nhân viên '{code}' bị lặp lại nhiều dòng trong file.");
                    isNewEmployee = !existingEmployeeCodes.Contains(code);
                    if (isNewEmployee && (string.IsNullOrWhiteSpace(lastName) || string.IsNullOrWhiteSpace(firstName)))
                        errors.Add($"Mã nhân viên '{code}' chưa có trong hệ thống — thiếu Họ hoặc Tên để tạo mới.");
                }

                int? lineId = null;
                var blockCode = row.BlockCode?.Trim();
                if (string.IsNullOrWhiteSpace(blockCode))
                    errors.Add("Thiếu mã BLOCK.");
                else if (linesByCode.TryGetValue(blockCode, out var foundLineId))
                    lineId = foundLineId;
                else
                    errors.Add($"Mã BLOCK '{blockCode}' không khớp Line nào trong hệ thống.");

                int? teamId = null;
                var teamCode = row.TeamCode?.Trim();
                // Chuẩn hoá NGAY ở bước này (2026-09-05) — trước đây chỉ dùng translatedTeamCode để tra
                // TeamId rồi vứt đi, còn TeamCode lưu xuống DB vẫn là chữ thô "A"/"B" dù TeamId đã trỏ
                // đúng ProductionTeam "1"/"2", gây lệch giữa 2 cột. Từ giờ TeamCode trong DTO (và vì vậy
                // cả trong ProductionEmployee) LUÔN là mã đã dịch, khớp ProductionTeam.Code.
                var translatedTeamCode = teamCode != null && TeamCodeTranslation.TryGetValue(teamCode, out var translated) ? translated : teamCode;
                if (string.IsNullOrWhiteSpace(teamCode))
                {
                    errors.Add("Thiếu mã GROUP.");
                }
                else
                {
                    if (teamsByCode.TryGetValue(translatedTeamCode!, out var foundTeamId))
                        teamId = foundTeamId;
                    else
                        errors.Add($"Mã GROUP '{teamCode}' không khớp Team nào trong hệ thống.");
                }

                int? shiftTeamId = null;
                var shiftTeamCode = row.ShiftTeamCode?.Trim();
                if (string.IsNullOrWhiteSpace(shiftTeamCode))
                    errors.Add("Thiếu mã NHOM.");
                else if (shiftTeamsByCode.TryGetValue(shiftTeamCode, out var foundShiftTeamId))
                    shiftTeamId = foundShiftTeamId;
                else
                    errors.Add($"Mã NHOM '{shiftTeamCode}' không khớp Nhóm ca nào trong hệ thống.");

                var isValid = errors.Count == 0;
                var isNewProductionEmployee = true;
                var isUpdatedProductionEmployee = false;

                if (isValid && code != null && existingProductionEmployeesByCode.TryGetValue(code, out var existingPe))
                {
                    isNewProductionEmployee = false;
                    isUpdatedProductionEmployee =
                        !string.Equals(existingPe.CongDoan, row.CongDoan, StringComparison.Ordinal) ||
                        !string.Equals(existingPe.TaskName, row.TaskName, StringComparison.Ordinal) ||
                        !string.Equals(existingPe.BlockCode, blockCode, StringComparison.Ordinal) ||
                        existingPe.ProductionLineId != lineId ||
                        !string.Equals(existingPe.TeamCode, translatedTeamCode, StringComparison.Ordinal) ||
                        existingPe.TeamId != teamId ||
                        !string.Equals(existingPe.ShiftTeamCode, shiftTeamCode, StringComparison.Ordinal) ||
                        existingPe.ShiftTeamId != shiftTeamId ||
                        existingPe.IsLeader != row.IsLeader ||
                        existingPe.EmployeeId == null;
                }

                result.Add(new ProductionEmployeeImportRowDto
                {
                    RowNumber = row.RowNumber,
                    EmployeeCode = code,
                    LastName = lastName,
                    FirstName = firstName,
                    CongDoan = row.CongDoan,
                    TaskName = row.TaskName,
                    BlockCode = blockCode,
                    TeamCode = translatedTeamCode,
                    ShiftTeamCode = shiftTeamCode,
                    IsLeader = row.IsLeader,
                    OtMonthHours = row.OtMonthHours,
                    OtYearHours = row.OtYearHours,
                    ResolvedProductionLineId = lineId,
                    ResolvedTeamId = teamId,
                    ResolvedShiftTeamId = shiftTeamId,
                    IsNewEmployee = isNewEmployee,
                    IsNewProductionEmployee = isNewProductionEmployee,
                    IsUpdatedProductionEmployee = isUpdatedProductionEmployee,
                    IsValid = isValid,
                    Errors = errors
                });
            }

            // Người đang có trong ProductionEmployees nhưng KHÔNG còn xuất hiện trong file mới (kể cả
            // dòng lỗi vẫn tính là "còn nhắc tới", chỉ dòng nào vắng mặt hoàn toàn mới bị gỡ).
            var codesStillInFile = rawRows
                .Select(r => r.EmployeeCode?.Trim())
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .ToHashSet(StringComparer.OrdinalIgnoreCase)!;

            var removedRows = existingProductionEmployeesByCode.Values
                .Where(pe => !codesStillInFile.Contains(pe.EmployeeCode.Trim()))
                .Select(pe => new ProductionEmployeeRemovedRowDto
                {
                    EmployeeCode = pe.EmployeeCode,
                    FullName = pe.Employee != null ? $"{pe.Employee.LastName} {pe.Employee.FirstName}" : pe.EmployeeCode
                })
                .ToList();

            return (result, removedRows);
        }

        private static HashSet<string> FindDuplicates(List<ProductionEmployeeImportRowDto> rows, Func<ProductionEmployeeImportRowDto, string?> selector)
        {
            return rows
                .Select(selector)
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v!.Trim())
                .GroupBy(v => v, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        // Cột theo đúng file mẫu Import_Nhan_Su_Che_Tao.xlsx (sheet OT(N+1)): A=KHOI SU (bỏ qua, xem
        // docs §Import nhân sự dưới chuyền), B=MNV, C=BOPHAN, D=HO, E=TEN, F=CÔNG VIỆC, G=OT month,
        // H=OT year, I=BLOCK, J=NHOM, K=GROUP, L/M/N=rác ("SX" cố định + cột trống), O=LEADER, P=rác
        // (#REF! công thức Excel hỏng). Dò dòng tiêu đề bằng cột B="MNV" thay vì cố định dòng 1 — cùng
        // lý do EmployeeImportService.ParseXlsx (file thật có thể có dòng tiêu đề ở vị trí khác).
        private const string HeaderMarkerCellB = "MNV";

        private static List<ProductionEmployeeImportRowDto> ParseXlsx(Stream stream)
        {
            XLWorkbook workbook;
            try
            {
                workbook = new XLWorkbook(stream);
            }
            catch (Exception ex) when (ex is not DomainException)
            {
                throw new DomainException(
                    "File Excel không hợp lệ hoặc bị hỏng, vui lòng kiểm tra lại file (chỉ hỗ trợ định dạng .xlsx).",
                    new List<string> { $"{ex.GetType().Name}: {ex.Message}" });
            }

            using var _ = workbook;
            var worksheet = workbook.Worksheets.First();
            var usedRange = worksheet.RangeUsed();

            var rows = new List<ProductionEmployeeImportRowDto>();
            if (usedRange == null) return rows;

            var allUsedRows = usedRange.RowsUsed().ToList();
            var headerRow = allUsedRows.FirstOrDefault(r =>
                string.Equals(r.Cell(2).GetString().Trim(), HeaderMarkerCellB, StringComparison.OrdinalIgnoreCase));

            if (headerRow == null)
                throw new DomainException($"Không tìm thấy dòng tiêu đề (cột B = \"{HeaderMarkerCellB}\") trong file — kiểm tra lại đúng mẫu file nhân sự dưới chuyền.");

            foreach (var xlRow in allUsedRows.Where(r => r.RowNumber() > headerRow.RowNumber()))
            {
                var employeeCode = xlRow.Cell(2).GetString().Trim();
                if (string.IsNullOrWhiteSpace(employeeCode)) continue;

                var otMonth = xlRow.Cell(7).TryGetValue<decimal>(out var otMonthValue) ? otMonthValue : (decimal?)null;
                var otYear = xlRow.Cell(8).TryGetValue<decimal>(out var otYearValue) ? otYearValue : (decimal?)null;

                rows.Add(new ProductionEmployeeImportRowDto
                {
                    RowNumber = xlRow.RowNumber(),
                    EmployeeCode = employeeCode,
                    CongDoan = NullIfBlank(xlRow.Cell(3).GetString()),
                    LastName = NullIfBlank(xlRow.Cell(4).GetString()),
                    FirstName = NullIfBlank(xlRow.Cell(5).GetString()),
                    TaskName = NullIfBlank(xlRow.Cell(6).GetString()),
                    OtMonthHours = otMonth,
                    OtYearHours = otYear,
                    BlockCode = NullIfBlank(xlRow.Cell(9).GetString()),
                    ShiftTeamCode = NullIfBlank(xlRow.Cell(10).GetString()),
                    TeamCode = NullIfBlank(xlRow.Cell(11).GetString()),
                    IsLeader = xlRow.Cell(15).GetString().Trim() == "1"
                });
            }

            return rows;
        }

        private static string? NullIfBlank(string value)
        {
            var trimmed = value.Trim();
            return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
        }

        // File mẫu tải xuống (2026-08-27, theo yêu cầu người dùng) — ĐÚNG vị trí cột A..O của
        // Import_Nhan_Su_Che_Tao.xlsx (xem ParseXlsx ở trên), dùng lại nguyên header text với
        // ProductionEmployeeExportService để 2 file (mẫu import / xuất) luôn khớp nhau. Kèm 1 dòng ví
        // dụ, không phải dữ liệu thật.
        public (byte[] Content, string FileName) GenerateTemplate()
        {
            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("OT(N+1)");

            string[] headers =
            {
                "KHOI SU", "MNV", "BOPHAN", "HO", "TEN", "CÔNG VIỆC", "OT month", "OT year",
                "BLOCK", "NHOM", "GROUP", "", "", "", "LEADER"
            };
            for (var col = 0; col < headers.Length; col++)
                sheet.Cell(1, col + 1).Value = headers[col];
            sheet.Row(1).Style.Font.Bold = true;

            sheet.Cell(2, 2).Value = "NV001";
            sheet.Cell(2, 3).Value = "GT";
            sheet.Cell(2, 4).Value = "Nguyễn";
            sheet.Cell(2, 5).Value = "Văn A";
            sheet.Cell(2, 6).Value = "SHIPPING";
            sheet.Cell(2, 9).Value = "HC";
            sheet.Cell(2, 10).Value = "HC";
            sheet.Cell(2, 11).Value = "A";
            sheet.Cell(2, 15).Value = 1;

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return (stream.ToArray(), "Mau_Import_NhanSuDuoiChuyen.xlsx");
        }
    }
}
