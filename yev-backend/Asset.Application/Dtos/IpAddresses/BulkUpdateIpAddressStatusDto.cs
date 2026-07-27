using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.IpAddresses
{
    // Bulk update of the IpAddress status (2026-07-23): tick several IPs on the grid and switch them
    // all at once between Available(0) and AssignedExternal(1). Same invariant as the single update
    // (UpdateIpAddressDto): Assigned(2) is only ever set by the system through assign/unassign, so it
    // is rejected here; IPs currently attached to a device are skipped instead of failing the batch
    // (same "skip and report" pattern as Device bulk-delete).
    public class BulkUpdateIpAddressStatusRequestDto
    {
        [Required(ErrorMessage = "Danh sách địa chỉ IP cần cập nhật không được để trống.")]
        [MinLength(1, ErrorMessage = "Danh sách địa chỉ IP cần cập nhật không được để trống.")]
        public List<int> Ids { get; set; } = new();

        [Required(ErrorMessage = "Trạng thái không được để trống")]
        [Range(0, 2, ErrorMessage = "Trạng thái không hợp lệ")]
        public int Status { get; set; }

        // Note is only touched when UpdateNote = true — otherwise every selected IP keeps its own
        // note (a bulk status change must not silently wipe individual notes). With UpdateNote = true
        // the value below is applied to all of them, including null/empty to clear the notes.
        public bool UpdateNote { get; set; }

        public string? Note { get; set; }
    }

    // 1 IP skipped during the batch — does not block the rest.
    public class BulkUpdateIpAddressStatusSkippedDto
    {
        public int Id { get; set; }
        public string? IpAddress { get; set; }
        public string Reason { get; set; } = null!;
    }

    public class BulkUpdateIpAddressStatusResultDto
    {
        public int UpdatedCount { get; set; }
        public int Status { get; set; }
        public string StatusText { get; set; } = null!;
        public List<BulkUpdateIpAddressStatusSkippedDto> SkippedIpAddresses { get; set; } = new();
    }
}
