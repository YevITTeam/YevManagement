namespace Workflow.Domain.Enums;

// workflow-module.md §1.6/§4 — CHỈ có 2 giá trị, KHÔNG có "ApplicantAncestor" (đã bỏ theo quyết định
// 2026-08-20). Fixed = luôn 1 đơn vị cố định; ApplicantUnit = đơn vị chính của người nộp đơn.
public enum OrgUnitScope
{
    Fixed = 1,
    ApplicantUnit = 2
}
