using Attendance.Application.Dtos.EmployeeIdentityLinkImports;
using Attendance.Application.Dtos.Employees;
using Attendance.Application.Interfaces.Service;
using Attendance.Domain.Enums;
using ClosedXML.Excel;
using System.Net.Mail;
using Shared.Application.Helper;
using Shared.Application.Interfaces;
using Shared.Application.Services;
using Shared.Core.Exceptions;

namespace Attendance.Application.Services
{
    // One-stop setup of an OT system user: B=MNV, C=UserName, D=Email, E=MaChucVu, F=NguoiPhuTrach, G=signature
    // image anchored on the row. Job title/coordinator apply to the employee's current Group/Department only.
    public class EmployeeIdentityLinkImportService : BaseService<IAttendanceUnitOfWork>, IEmployeeIdentityLinkImportService
    {
        private const string HeaderMarkerCellB = "MNV";
        private const string CoordinatorFlagTrueValue = "1";
        // Label-only role (no permissions); OT rights come from the job title and coordinator role.
        private const string OtRoleName = "Quản lý tăng ca";

        private readonly IUserDirectoryService _userDirectoryService;
        private readonly IEmployeeService _employeeService;
        private readonly IUserSignatureService _userSignatureService;
        private readonly IDepartmentApprovalStepCoordinatorService _departmentCoordinatorService;
        private readonly IGroupApprovalStepCoordinatorService _groupCoordinatorService;

        public EmployeeIdentityLinkImportService(
            IAttendanceUnitOfWork unitOfWork,
            IUserDirectoryService userDirectoryService,
            IEmployeeService employeeService,
            IUserSignatureService userSignatureService,
            IDepartmentApprovalStepCoordinatorService departmentCoordinatorService,
            IGroupApprovalStepCoordinatorService groupCoordinatorService) : base(unitOfWork)
        {
            _userDirectoryService = userDirectoryService;
            _employeeService = employeeService;
            _userSignatureService = userSignatureService;
            _departmentCoordinatorService = departmentCoordinatorService;
            _groupCoordinatorService = groupCoordinatorService;
        }

        public async Task<EmployeeIdentityLinkImportPreviewResultDto> PreviewAsync(Stream excelFileStream)
        {
            var (rawRows, _) = ParseXlsx(excelFileStream);
            var rows = await ValidateRowsAsync(rawRows);

            return new EmployeeIdentityLinkImportPreviewResultDto
            {
                Rows = rows,
                TotalRows = rows.Count,
                ValidRows = rows.Count(r => r.IsValid),
                InvalidRows = rows.Count(r => !r.IsValid),
                NewIdentityUserCount = rows.Count(r => r.IsValid && !r.IdentityUserAlreadyExists),
                RowsWithSignatureCount = rows.Count(r => r.IsValid && r.HasSignatureImage),
                RowsWithJobTitleCount = rows.Count(r => r.IsValid && !string.IsNullOrWhiteSpace(r.JobTitleCode)),
                RowsWithCoordinatorCount = rows.Count(r => r.IsValid && r.IsCoordinator)
            };
        }

        public async Task<EmployeeIdentityLinkImportConfirmResultDto> ConfirmAsync(Stream excelFileStream)
        {
            var (rawRows, imagesByRow) = ParseXlsx(excelFileStream);
            var validatedRows = await ValidateRowsAsync(rawRows);

            var result = new EmployeeIdentityLinkImportConfirmResultDto();

            foreach (var row in validatedRows)
            {
                if (!row.IsValid)
                {
                    result.SkippedCount++;
                    result.SkippedRows.Add(new EmployeeIdentityLinkImportSkippedRowDto
                    {
                        RowNumber = row.RowNumber,
                        EmployeeCode = row.EmployeeCode,
                        Errors = row.Errors
                    });
                    continue;
                }

                try
                {
                    // Identity first: if it fails nothing is written to Attendance (two DBs, no shared transaction).
                    var employee = await _unitOfWork.Employees.FirstOrDefaultAsync(x => x.Code == row.EmployeeCode && !x.IsDeleted);
                    employee.OrThrowNotFound("Nhân viên", row.EmployeeCode!);

                    var fullName = $"{employee!.LastName} {employee.FirstName}".Trim();
                    var createdUser = await _userDirectoryService.EnsureUserExistsAsync(row.UserName!, fullName, OtRoleName);
                    if (createdUser) result.CreatedIdentityUserCount++;
                    if (row.Email != null && await _userDirectoryService.SetModuleEmailAsync(row.UserName!, EmailModules.Attendance, row.Email))
                        result.EmailSetCount++;

                    var oldUserName = employee.UserName;
                    if (oldUserName != row.UserName)
                    {
                        employee.UserName = row.UserName;
                        _unitOfWork.Employees.Update(employee);
                        await _unitOfWork.SaveChangesAsync();

                        // Đổi sang UserName khác (không phải gán lần đầu) — thu hồi quyền tự động đã cấp
                        // khỏi tài khoản cũ, cùng nguyên tắc EmployeeService.UpdateAsync.
                        if (!string.IsNullOrWhiteSpace(oldUserName))
                            await _userDirectoryService.SyncAutoGrantedPermissionsAsync(oldUserName, Array.Empty<string>());
                    }

                    // Gán Chức vụ (nếu có) — LUÔN theo đúng phạm vi Bộ phận/Nhóm HIỆN TẠI của Employee,
                    // tái dùng nguyên xi 2 hàm đã có (AssignDepartmentJobTitleAsync/AssignGroupJobTitleAsync)
                    // để không lặp lại luật validate TerminalLevel — isAdmin=true nên userName truyền vào
                    // không được dùng tới (chỉ dùng khi !isAdmin).
                    if (!string.IsNullOrWhiteSpace(row.JobTitleCode))
                    {
                        var jobTitle = await _unitOfWork.JobTitles.FirstOrDefaultAsync(x => x.Code == row.JobTitleCode && !x.IsDeleted);
                        jobTitle.OrThrowNotFound("Chức vụ", row.JobTitleCode);

                        if (employee.DepartmentId.HasValue)
                            await _employeeService.AssignDepartmentJobTitleAsync(string.Empty, true, employee.Id, employee.DepartmentId.Value, jobTitle!.Id);
                        else if (employee.GroupId.HasValue)
                            await _employeeService.AssignGroupJobTitleAsync(string.Empty, true, employee.Id, employee.GroupId.Value, jobTitle!.Id);
                        else
                            throw new DomainException($"Nhân viên '{row.EmployeeCode}' chưa thuộc Bộ phận/Nhóm nào — không xác định được phạm vi để gán Chức vụ.");

                        result.JobTitleAssignedCount++;
                    }

                    // Người phụ trách Cây duyệt (nếu đánh dấu) — phạm vi suy ra từ tổ chức hiện tại,
                    // CHỈ THÊM vào danh sách, không đụng người phụ trách khác đã gán từ trước.
                    if (row.IsCoordinator)
                    {
                        if (employee.GroupId.HasValue)
                            await _groupCoordinatorService.EnsureCoordinatorAsync(employee.GroupId.Value, employee.Id);
                        else if (employee.DepartmentId.HasValue)
                            await _departmentCoordinatorService.EnsureCoordinatorAsync(employee.DepartmentId.Value, employee.Id);
                        else
                            throw new DomainException($"Nhân viên '{row.EmployeeCode}' chưa thuộc Bộ phận/Nhóm nào — không xác định được phạm vi người phụ trách.");

                        result.CoordinatorAddedCount++;
                    }

                    // Permission theo Chức vụ/Coordinator có hiệu lực NGAY — không cần đăng nhập lại.
                    // (Assign*/EnsureCoordinatorAsync ở trên đã tự đồng bộ, gọi lại đây để chắc chắn khớp
                    // trạng thái CUỐI CÙNG sau khi cả 2 bước cùng chạy trong 1 dòng — idempotent.)
                    await _employeeService.SyncAutoGrantedPermissionsForEmployeeAsync(employee.Id);

                    if (imagesByRow.TryGetValue(row.RowNumber, out var signatureImage))
                    {
                        await _userSignatureService.AdminSetSignatureAsync(row.UserName!, SignatureCutout.Process(signatureImage));
                        result.SignatureSetCount++;
                    }

                    result.SuccessCount++;
                }
                catch (Exception ex) when (ex is DomainException or NotFoundException)
                {
                    result.SkippedCount++;
                    result.SkippedRows.Add(new EmployeeIdentityLinkImportSkippedRowDto
                    {
                        RowNumber = row.RowNumber,
                        EmployeeCode = row.EmployeeCode,
                        Errors = new List<string> { ex.Message }
                    });
                }
            }

            return result;
        }

        private async Task<List<EmployeeIdentityLinkImportRowDto>> ValidateRowsAsync(
            List<(int RowNumber, string? EmployeeCode, string? UserName, string? Email, string? JobTitleCode, bool IsCoordinator, bool HasSignatureImage)> rawRows)
        {
            var employeeCodes = rawRows.Where(r => !string.IsNullOrWhiteSpace(r.EmployeeCode))
                .Select(r => r.EmployeeCode!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var employeesByCode = employeeCodes.Count == 0
                ? new Dictionary<string, (int Id, string FullName, string? UserName, int? GroupId, string? GroupNameVn, int? DepartmentId, string? DepartmentNameVn)>(StringComparer.OrdinalIgnoreCase)
                : (await _unitOfWork.Employees.SelectAsync(
                    x => !x.IsDeleted && employeeCodes.Contains(x.Code),
                    x => new
                    {
                        x.Id,
                        x.Code,
                        FullName = x.LastName + " " + x.FirstName,
                        x.UserName,
                        x.GroupId,
                        GroupNameVn = x.Group != null ? x.Group.GroupNameVn : null,
                        x.DepartmentId,
                        DepartmentNameVn = x.Department != null ? x.Department.DepartmentNameVn : null
                    }))
                    .ToDictionary(x => x.Code, x => (x.Id, x.FullName, x.UserName, x.GroupId, x.GroupNameVn, x.DepartmentId, x.DepartmentNameVn), StringComparer.OrdinalIgnoreCase);

            var userNamesInFile = rawRows.Where(r => !string.IsNullOrWhiteSpace(r.UserName))
                .Select(r => r.UserName!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var duplicatedUserNamesInFile = rawRows
                .Where(r => !string.IsNullOrWhiteSpace(r.UserName))
                .GroupBy(r => r.UserName!.Trim(), StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            // 1 UserName đã gán cho 1 Employee KHÁC trong hệ thống — không cho import gán tiếp cho
            // Employee khác trong file này nữa (1 UserName chỉ nên link đúng 1 Employee).
            var employeesHoldingUserNames = userNamesInFile.Count == 0
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : (await _unitOfWork.Employees.SelectAsync(
                    x => !x.IsDeleted && x.UserName != null && userNamesInFile.Contains(x.UserName),
                    x => new { x.Code, x.UserName }))
                    .ToDictionary(x => x.UserName!, x => x.Code, StringComparer.OrdinalIgnoreCase);

            var jobTitleCodes = rawRows.Where(r => !string.IsNullOrWhiteSpace(r.JobTitleCode))
                .Select(r => r.JobTitleCode!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var jobTitlesByCode = jobTitleCodes.Count == 0
                ? new Dictionary<string, (string Name, int TerminalLevel)>(StringComparer.OrdinalIgnoreCase)
                : (await _unitOfWork.JobTitles.SelectAsync(
                    x => !x.IsDeleted && jobTitleCodes.Contains(x.Code),
                    x => new { x.Code, x.Name, x.TerminalLevel }))
                    .ToDictionary(x => x.Code, x => (x.Name, x.TerminalLevel), StringComparer.OrdinalIgnoreCase);

            var result = new List<EmployeeIdentityLinkImportRowDto>();
            foreach (var row in rawRows)
            {
                var errors = new List<string>();
                var employeeCode = row.EmployeeCode?.Trim();
                var userName = row.UserName?.Trim();
                var email = string.IsNullOrWhiteSpace(row.Email) ? null : row.Email.Trim().ToLowerInvariant();
                var jobTitleCode = string.IsNullOrWhiteSpace(row.JobTitleCode) ? null : row.JobTitleCode.Trim();

                (int Id, string FullName, string? UserName, int? GroupId, string? GroupNameVn, int? DepartmentId, string? DepartmentNameVn)? employee = null;
                if (string.IsNullOrWhiteSpace(employeeCode))
                {
                    errors.Add("Thiếu mã nhân viên (MNV).");
                }
                else if (!employeesByCode.TryGetValue(employeeCode, out var found))
                {
                    errors.Add($"Không tìm thấy nhân viên có mã '{employeeCode}' trong hệ thống.");
                }
                else
                {
                    employee = found;
                }

                if (string.IsNullOrWhiteSpace(userName))
                {
                    errors.Add("Thiếu UserName.");
                }
                else
                {
                    if (!userName.Contains('\\'))
                        errors.Add($"UserName '{userName}' phải có dạng DOMAIN\\tên đăng nhập, ví dụ YEV\\n.van.a.");
                    if (duplicatedUserNamesInFile.Contains(userName))
                        errors.Add($"UserName '{userName}' bị lặp lại nhiều dòng trong file.");
                    if (employeesHoldingUserNames.TryGetValue(userName, out var holderCode)
                        && !string.Equals(holderCode, employeeCode, StringComparison.OrdinalIgnoreCase))
                        errors.Add($"UserName '{userName}' đã được gán cho nhân viên khác (mã '{holderCode}').");
                }

                if (email != null && !MailAddress.TryCreate(email, out _))
                    errors.Add($"Email '{email}' không hợp lệ.");

                string? resolvedJobTitleName = null;
                if (jobTitleCode != null)
                {
                    if (!jobTitlesByCode.TryGetValue(jobTitleCode, out var jobTitle))
                        errors.Add($"Không tìm thấy Chức vụ có mã '{jobTitleCode}'.");
                    else if (jobTitle.TerminalLevel != (int)JobTitleTerminalLevel.None)
                        errors.Add($"Chức vụ '{jobTitleCode}' là cấp Trưởng phòng trở lên — gán ở màn Nhân viên, không qua import.");
                    else
                        resolvedJobTitleName = jobTitle.Name;
                }

                string? coordinatorScopeDescription = null;
                if (row.IsCoordinator && employee != null)
                {
                    if (employee.Value.GroupId.HasValue)
                        coordinatorScopeDescription = $"Nhóm {employee.Value.GroupNameVn}";
                    else if (employee.Value.DepartmentId.HasValue)
                        coordinatorScopeDescription = $"Bộ phận {employee.Value.DepartmentNameVn}";
                    else
                        errors.Add($"Nhân viên '{employeeCode}' chưa thuộc Bộ phận/Nhóm nào — không xác định được phạm vi người phụ trách.");
                }

                if (jobTitleCode != null && employee != null && !employee.Value.GroupId.HasValue && !employee.Value.DepartmentId.HasValue)
                    errors.Add($"Nhân viên '{employeeCode}' chưa thuộc Bộ phận/Nhóm nào — không xác định được phạm vi để gán Chức vụ.");

                result.Add(new EmployeeIdentityLinkImportRowDto
                {
                    RowNumber = row.RowNumber,
                    EmployeeCode = employeeCode,
                    UserName = userName,
                    Email = email,
                    JobTitleCode = jobTitleCode,
                    IsCoordinator = row.IsCoordinator,
                    HasSignatureImage = row.HasSignatureImage,
                    ResolvedEmployeeFullName = employee?.FullName,
                    CurrentUserNameOnEmployee = employee?.UserName,
                    ResolvedJobTitleName = resolvedJobTitleName,
                    CoordinatorScopeDescription = coordinatorScopeDescription,
                    // Preview không truy vấn Identity DB (khác module) — chỉ biết chắc "đã tồn tại" khi
                    // UserName hiện tại của chính Employee này khớp đúng UserName trong file; ngoài ra để
                    // NewIdentityUserCount là ước tính (Confirm mới là nguồn chân lý thật).
                    IdentityUserAlreadyExists = employee?.UserName == userName,
                    IsValid = errors.Count == 0,
                    Errors = errors
                });
            }

            return result;
        }

        private static (
            List<(int RowNumber, string? EmployeeCode, string? UserName, string? Email, string? JobTitleCode, bool IsCoordinator, bool HasSignatureImage)> Rows,
            Dictionary<int, byte[]> ImagesByRow)
            ParseXlsx(Stream stream)
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

            // Ảnh chữ ký nhúng — neo theo đúng hàng qua TopLeftCell. 1 ảnh/1 hàng, ảnh sau đè ảnh trước
            // nếu trùng hàng (không nên xảy ra với file chuẩn).
            var imagesByRow = new Dictionary<int, byte[]>();
            foreach (var picture in worksheet.Pictures)
            {
                var rowNumber = picture.TopLeftCell.Address.RowNumber;
                imagesByRow[rowNumber] = picture.ImageStream.ToArray();
            }

            var rows = new List<(int, string?, string?, string?, string?, bool, bool)>();
            if (usedRange == null) return (rows, imagesByRow);

            // worksheet.Cell(row, col) tuyệt đối — KHÔNG dùng xlRow.Cell(col) (range-relative: cột A
            // trống hoàn toàn khiến ClosedXML tự thu hẹp usedRange bắt đầu từ cột B, Cell(2) trỏ nhầm
            // sang cột C) — đã tái hiện lỗi thật với chính file mẫu do GenerateTemplate() sinh ra
            // (2026-09-03, xem docs/docs-be/attendance-module.md).
            var allUsedRows = usedRange.RowsUsed().ToList();
            var headerRow = allUsedRows.FirstOrDefault(r =>
                string.Equals(worksheet.Cell(r.RowNumber(), 2).GetString().Trim(), HeaderMarkerCellB, StringComparison.OrdinalIgnoreCase));
            if (headerRow == null)
                throw new DomainException(
                    $"Không tìm thấy dòng tiêu đề (cột B = \"{HeaderMarkerCellB}\") trong file — đúng mẫu là cột B=MNV, C=UserName, D=Email, E=MaChucVu, F=NguoiPhuTrach.");

            foreach (var xlRow in allUsedRows.Where(r => r.RowNumber() > headerRow.RowNumber()))
            {
                var employeeCode = worksheet.Cell(xlRow.RowNumber(), 2).GetString().Trim();
                var userName = worksheet.Cell(xlRow.RowNumber(), 3).GetString().Trim();
                var email = worksheet.Cell(xlRow.RowNumber(), 4).GetString().Trim();
                var jobTitleCode = worksheet.Cell(xlRow.RowNumber(), 5).GetString().Trim();
                var isCoordinator = worksheet.Cell(xlRow.RowNumber(), 6).GetString().Trim() == CoordinatorFlagTrueValue;
                var hasImage = imagesByRow.ContainsKey(xlRow.RowNumber());

                var isRowEmpty = string.IsNullOrWhiteSpace(employeeCode) && string.IsNullOrWhiteSpace(userName) && !hasImage;
                if (isRowEmpty) continue;

                rows.Add((
                    xlRow.RowNumber(),
                    string.IsNullOrWhiteSpace(employeeCode) ? null : employeeCode,
                    string.IsNullOrWhiteSpace(userName) ? null : userName,
                    string.IsNullOrWhiteSpace(email) ? null : email,
                    string.IsNullOrWhiteSpace(jobTitleCode) ? null : jobTitleCode,
                    isCoordinator,
                    hasImage));
            }

            return (rows, imagesByRow);
        }

        private static readonly string[] Notes =
        {
            "Mỗi dòng 1 nhân viên đã có trong hệ thống (người mới: import nhân sự trước). Tài khoản chưa có sẽ được tạo tự động, kèm nhãn Quản lý tăng ca.",
            "UserName: tài khoản Windows đầy đủ dạng YEV\\tên.đăng.nhập.",
            "Email (tuỳ chọn): địa chỉ nhận thông báo của hệ thống Tăng ca. Để trống = giữ nguyên.",
            "MaChucVu: chọn trong danh sách, chỉ chức vụ cấp trung gian; quyền theo Chức vụ được cấp ngay. Trưởng phòng/Trưởng xưởng/Giám đốc gán ở màn Nhân viên.",
            "NguoiPhuTrach = 1: thêm làm Người phụ trách Cây duyệt của Nhóm/Bộ phận hiện tại của nhân viên.",
            "Ảnh chữ ký (tuỳ chọn): chèn ảnh nằm gọn trong đúng dòng của nhân viên.",
        };

        private static readonly ImportTemplateColumn[] Columns =
        {
            new("MNV", 14, true, "@"),
            new("UserName", 24, true, "@"),
            new("Email", 30, false),
            new("MaChucVu", 12, false),
            new("NguoiPhuTrach", 14, false, "@", new[] { new ImportTemplateOption(CoordinatorFlagTrueValue, "Là Người phụ trách") }),
            new("Ảnh chữ ký", 24, false),
        };

        private async Task<ImportTemplateColumn[]> ColumnsWithOptionsAsync()
        {
            var jobTitles = await _unitOfWork.JobTitles.SelectAsync(
                x => !x.IsDeleted && x.TerminalLevel == (int)JobTitleTerminalLevel.None,
                x => new ImportTemplateOption(x.Code, x.Name));
            var columns = Columns.ToArray();
            columns[3] = columns[3] with { Options = jobTitles.OrderBy(x => x.Value).ToList() };
            return columns;
        }

        public async Task<(byte[] Content, string FileName)> GenerateTemplateAsync() => ImportTemplateBuilder.Build(
            "Lien ket tai khoan", "MẪU LIÊN KẾT TÀI KHOẢN ĐĂNG NHẬP", Notes, await ColumnsWithOptionsAsync(),
            new[] { new object?[] { "NV001", "YEV\\n.van.a", "n.van.a@yev.vn", "TL", "1" } },
            "Mau_Import_LienKetTaiKhoan.xlsx",
            dataRowHeight: 45);

        // Job titles of managers and above are left blank: this import refuses them.
        public async Task<(byte[] Content, string FileName)> ExportAsync(EmployeeExportFilterDto filter, string userName, bool isAdmin)
        {
            var employees = await _employeeService.GetForExportAsync(userName, isAdmin, filter);
            var emails = await _userDirectoryService.GetModuleEmailsAsync(
                employees.Where(x => x.UserName != null).Select(x => x.UserName!).ToList(), EmailModules.Attendance);
            var rows = employees
                .Select(x => new object?[]
                {
                    x.Code, x.UserName, x.UserName != null ? emails.GetValueOrDefault(x.UserName) : null,
                    x.TerminalLevel == (int)JobTitleTerminalLevel.None ? x.JobTitleCode : null, null
                })
                .ToList();
            return ImportTemplateBuilder.Build("Lien ket tai khoan", "LIÊN KẾT TÀI KHOẢN ĐĂNG NHẬP", Notes, await ColumnsWithOptionsAsync(), rows,
                $"LienKetTaiKhoan_{TimeHelper.GetCurrentUtcTime().AddHours(7):yyyyMMdd_HHmm}.xlsx", rowsAreSamples: false);
        }
    }
}
