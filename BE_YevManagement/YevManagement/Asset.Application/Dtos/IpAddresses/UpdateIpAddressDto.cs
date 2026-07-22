using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.IpAddresses
{
    // Update IpAddress — ONLY allows changing Status + Note (2026-07-11, user decision).
    // Does not allow changing IpAddress/IpPrefix/DeviceId (the IP is fixed based on the prefix;
    // assigning/unassigning a device goes through separate assign/unassign actions). Valid
    // Status values: 0=Unassigned, 1=Assigned (external); 2=Assigned is only set automatically
    // by the system when there is a DeviceId, it cannot be set manually here.
    public class UpdateIpAddressDto
    {
        [Required(ErrorMessage = "Id không được để trống")]
        public int Id { get; set; }

        [Required(ErrorMessage = "Trạng thái không được để trống")]
        [Range(0, 2, ErrorMessage = "Trạng thái không hợp lệ")]
        public int Status { get; set; }

        public string? Note { get; set; }
    }
}
