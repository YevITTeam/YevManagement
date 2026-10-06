namespace Workflow.Application.Dtos.OrgUnits
{
    // 1 dòng "ai đang giữ chức gì" hiện kèm theo node trên cây tổ chức (GET /OrgUnit/tree) — tránh
    // người dùng phải rời màn cây sang màn Nhân sự chỉ để xem đơn vị này ai đang phụ trách.
    public class OrgUnitTreeMemberDto
    {
        // EmployeeOrgUnits.Id — identifies the assignment row for per-row update/remove.
        public int AssignmentId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeFullName { get; set; } = null!;
        public string EmployeeCode { get; set; } = null!;
        public int? JobTitleId { get; set; }
        public string? JobTitleNameVn { get; set; }
        // Số nhỏ = cao hơn (JobTitles.RankOrder, workflow-module.md §3.1) — FE dùng để nhóm/thụt lề
        // kiểu cây thư mục, KHÔNG dùng suy luận nghiệp vụ nào khác (đúng giới hạn RankOrder đã chốt).
        public int? JobTitleRankOrder { get; set; }
        public bool IsPrimary { get; set; }
    }
}
