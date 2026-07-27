using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.TransferHistories
{
    public class CreateTransferHistoryDto
    {
        [Required(ErrorMessage = "Thiết bị cũ không được để trống")]
        public int OldDeviceId { get; set; }

        [Required(ErrorMessage = "Thiết bị mới không được để trống")]
        public int NewDeviceId { get; set; }

        public string? Note { get; set; }
    }
}
