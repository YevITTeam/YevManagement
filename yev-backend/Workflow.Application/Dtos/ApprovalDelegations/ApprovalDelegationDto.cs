namespace Workflow.Application.Dtos.ApprovalDelegations
{
    public class ApprovalDelegationDto
    {
        public int Id { get; set; }
        public int DelegatorEmployeeId { get; set; }
        public string DelegatorEmployeeName { get; set; } = null!;
        public int DelegateEmployeeId { get; set; }
        public string DelegateEmployeeName { get; set; } = null!;
        public int? FormDefinitionId { get; set; }
        public string? FormDefinitionNameVn { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public string? Reason { get; set; }
    }
}
