using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.IpAddresses
{
    public class AssignIpAddressDto
    {
        [Required(ErrorMessage = "Thiết bị không được để trống")]
        public int DeviceId { get; set; }
    }
}
