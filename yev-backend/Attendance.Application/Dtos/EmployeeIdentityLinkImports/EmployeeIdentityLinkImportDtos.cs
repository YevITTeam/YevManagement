namespace Attendance.Application.Dtos.EmployeeIdentityLinkImports
{
    // Import Excel hàng loạt liên kết Employee (Attendance) ↔ User (Identity), tự tạo tài khoản Identity
    // nếu chưa có + gán chữ ký thẳng — Admin-only (2026-09-03, xem
    // docs/docs-be/attendance-module.md §Import liên kết Identity + chữ ký). Preview VÀ Confirm đều tự
    // đọc file (KHÔNG truyền Rows qua JSON như các import khác trong module) vì mỗi dòng có thể kèm 1
    // ảnh chữ ký nhúng — Confirm luôn re-parse + re-validate lại từ đầu, không tin bất kỳ dữ liệu nào
    // Preview trả về.
    //
    // Mở rộng 2026-09-03b: thêm cột E=MaChucVu (Chức vụ) + F=NguoiPhuTrach (người phụ trách Cây duyệt)
    // — cả 2 đều SUY RA phạm vi (Bộ phận/Nhóm) từ chính tổ chức HIỆN TẠI của Employee
    // (Employee.DepartmentId/GroupId, đã có sẵn từ import nhân sự trước đó), KHÔNG cho chọn phạm vi
    // khác trong file này — xem EmployeeIdentityLinkImportService.ConfirmAsync.
    public class EmployeeIdentityLinkImportRowDto
    {
        public int RowNumber { get; set; }
        public string? EmployeeCode { get; set; }
        public string? UserName { get; set; }
        public string? RoleName { get; set; }
        public string? JobTitleCode { get; set; }
        public bool IsCoordinator { get; set; }
        public bool HasSignatureImage { get; set; }

        // Chỉ có ý nghĩa khi IsValid — cho Admin xem trước sẽ xảy ra gì trước khi Confirm.
        public string? ResolvedEmployeeFullName { get; set; }
        public bool IdentityUserAlreadyExists { get; set; }
        public string? CurrentUserNameOnEmployee { get; set; }
        public string? ResolvedJobTitleName { get; set; }
        // "Bộ phận X" / "Nhóm Y" — phạm vi người phụ trách sẽ áp dụng, suy ra từ tổ chức hiện tại của
        // Employee. Null nếu IsCoordinator=false hoặc Employee chưa thuộc Bộ phận/Nhóm nào (→ lỗi).
        public string? CoordinatorScopeDescription { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }

    public class EmployeeIdentityLinkImportPreviewResultDto
    {
        public List<EmployeeIdentityLinkImportRowDto> Rows { get; set; } = new();
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        public int NewIdentityUserCount { get; set; }
        public int RowsWithSignatureCount { get; set; }
        public int RowsWithJobTitleCount { get; set; }
        public int RowsWithCoordinatorCount { get; set; }
    }

    public class EmployeeIdentityLinkImportSkippedRowDto
    {
        public int RowNumber { get; set; }
        public string? EmployeeCode { get; set; }
        public List<string> Errors { get; set; } = new();
    }

    public class EmployeeIdentityLinkImportConfirmResultDto
    {
        public int SuccessCount { get; set; }
        public int CreatedIdentityUserCount { get; set; }
        public int SignatureSetCount { get; set; }
        public int JobTitleAssignedCount { get; set; }
        public int CoordinatorAddedCount { get; set; }
        public int SkippedCount { get; set; }
        public List<EmployeeIdentityLinkImportSkippedRowDto> SkippedRows { get; set; } = new();
    }
}
