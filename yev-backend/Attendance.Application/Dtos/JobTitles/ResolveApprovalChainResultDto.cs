namespace Attendance.Application.Dtos.JobTitles
{
    public class ResolveApprovalChainResultDto
    {
        // False when the chain is stuck: some level has nobody holding the required job title (see Warning).
        public bool IsComplete { get; set; }

        public List<ResolvedApprovalStepDto> Steps { get; set; } = new();

        public string? Warning { get; set; }

        // True when the creator ranks at or above every required intermediate signer, so they sign the requester box themselves.
        public bool RequiresCreatorSelfSign { get; set; }
    }
}
